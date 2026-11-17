export { MongoGateway } from "./db";
import { apiRoute, expirePendingRequests } from "./routes";
import { currentUser, db, fail } from "./core";

export interface Env {
  /** Secrets are configured only at publication time; never commit their values. */
  MONGO_URL: string;
  DB_NAME: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  PILOT_RETURN_RESET_TOKEN?: string;
  APP_ENV?: string;
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
  if (pathname.startsWith("/assets/")) headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function corsPreflight(request: Request, env: Env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: {
    "access-control-allow-origin": origin, "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
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
  const stub = env.MONGO_GATEWAY.get(env.MONGO_GATEWAY.idFromName("acolhe-mongodb"));
  const realtimeHeaders: Record<string, string> = {
    upgrade: "websocket",
    "x-realtime-user": String(user.id),
    "x-realtime-role": String(user.role),
  };
  if (sessionId) realtimeHeaders["x-realtime-session"] = sessionId;
  return stub.fetch("https://realtime.internal/realtime/socket", {
    headers: realtimeHeaders,
    signal: AbortSignal.timeout(5_000),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return corsPreflight(request, env);
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && ["GET", "HEAD"].includes(request.method)) {
      const health = { ok: true, service: "acolhe", environment: env.APP_ENV || "production", checked_at: new Date().toISOString() };
      const response = request.method === "HEAD"
        ? new Response(null, { status: 200, headers: { "content-type": "application/json; charset=utf-8" } })
        : Response.json(health);
      return withCors(response, allowedOrigin(request, env));
    }
    if (!url.pathname.startsWith("/api")) return withAssetSecurity(await env.ASSETS.fetch(request), url.pathname);
    if (url.pathname === "/api/realtime" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      try { return await realtimeUpgrade(request, env, url); }
      catch (error) { console.error("Realtime upgrade failed", error); return withCors(fail("Não foi possível abrir o canal em tempo real", 503), allowedOrigin(request, env)); }
    }
    const csrfError = csrfFailure(request, env); if (csrfError) return withCors(csrfError, allowedOrigin(request, env));
    try {
      return withCors(await apiRoute(request, env, url.pathname), allowedOrigin(request, env));
    } catch (error) {
      console.error("Unhandled API error", error);
      return withCors(Response.json({ detail: "Erro interno do serviço" }, { status: 500 }), allowedOrigin(request, env));
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // Keep the 48-hour SLA clock independent from dashboard visits. The
    // request-triggered sweep remains as a fast consistency fallback.
    ctx.waitUntil(expirePendingRequests(db(env), env));
  },
} satisfies ExportedHandler<Env>;
