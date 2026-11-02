export { MongoGateway } from "./db";
import { apiRoute } from "./routes";

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
  DEFAULT_ACCOUNT_PASSWORD?: string;
  MONGO_GATEWAY: DurableObjectNamespace;
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
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.append("vary", "Origin");
  }
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return corsPreflight(request, env);
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api")) return new Response("Not found", { status: 404 });
    try {
      return withCors(await apiRoute(request, env, url.pathname), allowedOrigin(request, env));
    } catch (error) {
      console.error("Unhandled API error", error);
      return withCors(Response.json({ detail: "Erro interno do serviço" }, { status: 500 }), allowedOrigin(request, env));
    }
  },
} satisfies ExportedHandler<Env>;
