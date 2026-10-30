import { bearerToken, cookieToken, type Role, verifyAccessToken } from "./auth";
import { gateway, type Mongo, type RecordDoc } from "./db";
import type { Env } from "./index";

export type Doc = Record<string, any>;
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
export const fail = (detail: string, status: number) => json({ detail }, status);
export const db = (env: Env): Mongo => gateway(env);
export const publicUser = (user: Doc) => ({ id: user.id, name: user.name, email: user.email, role: user.role, institution_id: user.institution_id, active: user.active });
export const cookie = (token: string) => ({ "set-cookie": `access_token=${token}; HttpOnly; Secure; SameSite=None; Max-Age=604800; Path=/` });
export const clearCookie = () => ({ "set-cookie": "access_token=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/" });

export async function requestBody(request: Request): Promise<Doc | null> {
  try {
    const data = await request.json();
    return data && typeof data === "object" && !Array.isArray(data) ? data as Doc : null;
  } catch { return null; }
}

export function string(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
export function email(value: unknown) {
  const result = string(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : "";
}
export function oneOf(value: unknown, choices: readonly string[]) { return typeof value === "string" && choices.includes(value); }
export function tokenSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function logEvent(env: Env, type: string, user?: Doc, institutionId?: string, meta: Doc = {}) {
  await db(env).insert("events", { id: id(), type, user_id: user?.id, role: user?.role, institution_id: institutionId || user?.institution_id, meta, created_at: now() });
}

export async function currentUser(request: Request, env: Env): Promise<Doc | Response> {
  const token = cookieToken(request) || bearerToken(request);
  if (!token) return fail("Não autenticado", 401);
  try {
    const claims = await verifyAccessToken(token, env.JWT_SECRET);
    const user = await db(env).findOne("users", { id: claims.sub });
    if (!user) return fail("Usuário não encontrado", 401);
    if (user.active === false) return fail("Acesso desativado", 403);
    delete user.password_hash;
    return user;
  } catch { return fail("Sessão expirada ou token inválido", 401); }
}

export async function userWithRole(request: Request, env: Env, roles: Role[]): Promise<Doc | Response> {
  const user = await currentUser(request, env);
  if (user instanceof Response) return user;
  if (!roles.includes(user.role as Role)) return fail("Perfil sem permissão para esta operação", 403);
  return user;
}

export async function profile(env: Env, user: Doc): Promise<Doc | Response> {
  const collection = user.role === "student" ? "students" : "professionals";
  const result = await db(env).findOne(collection, { user_id: user.id });
  return result || fail("Perfil não encontrado", 404);
}

export function isResponse(value: unknown): value is Response { return value instanceof Response; }
export function asDoc(value: RecordDoc): Doc { return value as Doc; }
