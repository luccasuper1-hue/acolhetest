export { MongoGateway } from "./db";
import { apiRoute, expirePendingRequests, retryNotificationEmails } from "./routes";
import { gatewayObjectName } from "./runtime";
import { currentUser, db, fail, logOperational } from "./core";

export interface Env {
  /** Secrets are configured only at publication time; never commit their values. */
  MONGO_URL: string;
  DB_NAME: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  PILOT_RETURN_RESET_TOKEN?: string;
  APP_ENV?: string;
  /** Background maintenance is opt-in to prevent idle Durable Object usage. */
  SCHEDULED_MAINTENANCE_ENABLED?: string;
  /** HTTPS endpoint of the chosen transactional-email adapter. */
  RESET_EMAIL_WEBHOOK_URL?: string;
  RESET_EMAIL_WEBHOOK_TOKEN?: string;
  RESEND_API_KEY?: string;
  LEAD_EMAIL_TO?: string;
  RESEND_FROM?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  GMAIL_FROM?: string;
  MONGO_GATEWAY: DurableObjectNamespace;
  ASSETS: Fetcher;
}

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get("origin");
  return origin === env.FRONTEND_URL ? origin : undefined;
}

function withCors(response: Response, origin?: string): Response {
  const headers = new Headers(response.headers);
  // API responses can carry personal data. Keep them out of intermediary
  // caches and attach browser protections independent of CORS.
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.append("vary", "Origin");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function withAssetSecurity(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://api.qrserver.com; connect-src 'self' wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
  if (pathname.startsWith("/assets/")) {
    // Hashed bundles are safe to cache indefinitely.
    headers.set("cache-control", "public, max-age=31536000, immutable");
  } else {
    // HTML must be revalidated so a newly published bundle is picked up
    // instead of leaving users on the previous layout indefinitely.
    headers.set("cache-control", "no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function servePublicAsset(request: Request, env: Env, url: URL): Promise<Response> {
  const asset = await env.ASSETS.fetch(request);
  if (url.pathname !== "/sitemap.xml" || !asset.ok) return withAssetSecurity(asset, url.pathname);

  // The same build is used by production and staging. Keep sitemap links on
  // the origin that served them instead of leaking the production host from
  // a shared static asset bundle.
  const sitemap = await asset.text();
  const rewritten = sitemap.replace(/https?:\/\/[^/\s<]+/g, url.origin);
  const headers = new Headers(asset.headers);
  headers.delete("content-length");
  return withAssetSecurity(new Response(rewritten, {
    status: asset.status,
    statusText: asset.statusText,
    headers,
  }), url.pathname);
}

function corsPreflight(request: Request, env: Env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": origin, "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-max-age": "86400", vary: "Origin",
  } });
}

function csrfFailure(request: Request, env: Env) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const hasCookie = Boolean(request.headers.get("cookie")?.includes("access_token="));
  if (hasCookie && origin !== env.FRONTEND_URL) return new Response(JSON.stringify({ detail: "Origem não autorizada" }), { status: 403, headers: { "content-type": "application/json; charset=utf-8" } });
  const contentType = request.headers.get("content-type") || "";
  // Browsers may omit Content-Type for an empty DELETE body. The origin and
  // authenticated-cookie checks above still protect this same-origin case.
  if (request.method === "DELETE" && !contentType) return;
  // These actions intentionally have no request body. Keep them valid for
  // older cached clients while retaining the strict same-origin check above.
  if (!contentType && request.method === "POST") {
    const pathname = new URL(request.url).pathname;
    const bodylessAction =
      pathname === "/api/auth/logout" ||
      /^\/api\/students\/me\/requests\/[^/]+\/cancel$/.test(pathname) ||
      /^\/api\/professionals\/me\/requests\/[^/]+\/(accept|decline)$/.test(pathname) ||
      /^\/api\/professionals\/me\/sessions\/[^/]+\/complete$/.test(pathname) ||
      /^\/api\/admin\/users\/[^/]+\/toggle-active$/.test(pathname);
    if (bodylessAction) return;
  }
  if (!contentType.toLowerCase().includes("application/json")) return new Response(JSON.stringify({ detail: "Content-Type inválido" }), { status: 415, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function realtimeUpgrade(request: Request, env: Env, url: URL): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== env.FRONTEND_URL) return fail("Origem não autorizada", 403);
  const user = await currentUser(request, env);
  if (user instanceof Response) return user;
  const sessionId = url.searchParams.get("session_id")?.trim();
  if (sessionId) {
    const session = await db(env).findOne("sessions", { id: sessionId }, { student_id: 1, professional_id: 1, status: 1 });
    if (!session || session.status !== "scheduled") return fail("Conversa não encontrada", 404);
    const collection = user.role === "student" ? "students" : user.role === "professional" ? "professionals" : "";
    if (!collection) return fail("Perfil sem acesso ao chat", 403);
    const profile = await db(env).findOne(collection, { user_id: user.id }, { id: 1 });
    const allowed = user.role === "student" ? profile?.id === session.student_id : profile?.id === session.professional_id;
    if (!allowed) return fail("Você não participa desta conversa", 403);
  }
  const stub = env.MONGO_GATEWAY.get(env.MONGO_GATEWAY.idFromName(gatewayObjectName(env.APP_ENV)));
  const realtimeHeaders: Record<string, string> = {
    upgrade: "websocket",
    "x-realtime-user": String(user.id),
    "x-realtime-role": String(user.role),
  };
  if (sessionId) realtimeHeaders["x-realtime-session"] = sessionId;
  if (user.institution_id) realtimeHeaders["x-realtime-institution"] = String(user.institution_id);
  return stub.fetch("https://realtime.internal/realtime/socket", {
    headers: realtimeHeaders,
    signal: AbortSignal.timeout(5_000),
  });
}

function operationalHealth(request: Request, env: Env, payload: Record<string, unknown>, status: number): Response {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  const response = request.method === "HEAD"
    ? new Response(null, { status, headers })
    : Response.json(payload, { status, headers });
  return withCors(response, allowedOrigin(request, env));
}

// Health probes are often issued in bursts by monitors, browsers and deploy
// checks. Keep the database probe out of the hot path for a short window and
// share an in-flight probe so a burst cannot fan out into the Durable Object.
const READINESS_CACHE_MS = 15_000;
type ReadinessProbe = { database: "ok" | "unavailable"; checked_at: string };
let readinessCache: ({ expiresAt: number } & ReadinessProbe) | null = null;
let readinessProbe: Promise<ReadinessProbe> | null = null;
async function probeDatabase(env: Env) {
  const now = Date.now();
  if (readinessCache && readinessCache.expiresAt > now) return { database: readinessCache.database, checked_at: readinessCache.checked_at };
  if (readinessProbe) return readinessProbe;
  readinessProbe = (async () => {
    let database: "ok" | "unavailable" = "ok";
    try { await db(env).ping(); } catch { database = "unavailable"; }
    const result = { database, checked_at: new Date().toISOString() };
    readinessCache = { ...result, expiresAt: Date.now() + READINESS_CACHE_MS };
    return result;
  })().finally(() => { readinessProbe = null; });
  return readinessProbe;
}

async function edgeCachedHealth(request: Request, ctx: ExecutionContext, load: () => Promise<Response>): Promise<Response> {
  // Only cache anonymous GET probes. HEAD keeps the same semantics but does
  // not need a second cache key or body handling path.
  if (request.method !== "GET") return load();
  const cacheKey = new Request(request.url, { method: "GET" });
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;
  const response = await load();
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=5, stale-while-revalidate=10");
  const cacheable = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  ctx.waitUntil(caches.default.put(cacheKey, cacheable.clone()).catch(() => undefined));
  return cacheable;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") return corsPreflight(request, env);
    const url = new URL(request.url);
    if (["/api/live", "/api/ready", "/api/health"].includes(url.pathname) && ["GET", "HEAD"].includes(request.method)) {
      const base = { service: "acolhe", environment: env.APP_ENV || "production", checked_at: new Date().toISOString() };
      return edgeCachedHealth(request, ctx, async () => {
        if (url.pathname === "/api/live") return operationalHealth(request, env, { ...base, ok: true }, 200);
        const probe = await probeDatabase(env);
        const database = probe.database;
        const ready = database === "ok";
        return operationalHealth(request, env, { ...base, checked_at: probe.checked_at, ok: ready, database }, ready ? 200 : 503);
      });
    }
    if (!url.pathname.startsWith("/api")) return servePublicAsset(request, env, url);
    if (url.pathname === "/api/realtime" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      try { return await realtimeUpgrade(request, env, url); }
      catch (error) { logOperational("realtime_upgrade_failed", { method: request.method, route: url.pathname, error_name: error instanceof Error ? error.name : "unknown" }); return withCors(fail("Não foi possível abrir o canal em tempo real", 503), allowedOrigin(request, env)); }
    }
    const csrfError = csrfFailure(request, env); if (csrfError) return withCors(csrfError, allowedOrigin(request, env));
    try {
      const startedAt = Date.now();
      const response = withCors(await apiRoute(request, env, url.pathname, ctx), allowedOrigin(request, env));
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 1_000) logOperational("slow_request", { method: request.method, route: url.pathname, environment: env.APP_ENV || "unknown", status: response.status, duration_ms: durationMs, response_bytes: Number(response.headers.get("content-length") || 0) });
      return response;
    } catch (error) {
      logOperational("api_unhandled_error", { method: request.method, route: url.pathname, error_name: error instanceof Error ? error.name : "unknown" });
      return withCors(Response.json({ detail: "Erro interno do serviço" }, { status: 500 }), allowedOrigin(request, env));
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // Keep quota safe even if an old Cloudflare Cron Trigger remains
    // registered outside the checked-in Wrangler configuration.
    if (env.SCHEDULED_MAINTENANCE_ENABLED !== "true") return;
    // Keep the 48-hour SLA clock independent from dashboard visits. The
    // request-triggered sweep remains as a fast consistency fallback.
    const store = db(env);
    ctx.waitUntil((async () => {
      const nowIso = new Date().toISOString();
      const staleBeforeIso = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
      const expiringFromIso = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
      const expiringBeforeIso = new Date(Date.now() - 36 * 60 * 60_000).toISOString();
      const staleClaimIso = new Date(Date.now() - 10 * 60_000).toISOString();
      const snapshot = await store.getMaintenanceSnapshot(staleBeforeIso, expiringFromIso, expiringBeforeIso, nowIso, staleClaimIso);
      await Promise.all([
        expirePendingRequests(store, env, undefined, snapshot),
        retryNotificationEmails(env, store, snapshot.notificationCandidates),
      ]);
    })());
  },
} satisfies ExportedHandler<Env>;
