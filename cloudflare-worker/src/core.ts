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
export const publicInstitution = (institution: Doc | null) => institution ? ({ id: institution.id, name: institution.name, code: institution.code, plan: institution.plan, active: institution.active !== false }) : null;
export const cookie = (token: string) => ({ "set-cookie": `access_token=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/` });
export const clearCookie = () => ({ "set-cookie": "access_token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/" });

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

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function logEvent(env: Env, type: string, user?: Doc, institutionId?: string, meta: Doc = {}) {
  await db(env).insert("events", { id: id(), type, user_id: user?.id, role: user?.role, institution_id: institutionId || user?.institution_id, meta, created_at: now() });
}

export async function createNotification(env: Env, recipientUserId: string, type: string, title: string, body: string, meta: Doc = {}) {
  const notification = {
    id: id(), recipient_user_id: recipientUserId, type, title, body, meta,
    read: false, created_at: now(),
  };
  await db(env).insert("notifications", notification);
  await broadcastRealtime(env, { userId: recipientUserId, event: { type: "notification", notification } });
}

export async function createNotifications(env: Env, recipientUserIds: string[], type: string, title: string, body: string, meta: Doc = {}) {
  const recipients = [...new Set(recipientUserIds.filter(Boolean))];
  if (!recipients.length) return;
  const notifications = recipients.map(recipient_user_id => ({ id: id(), recipient_user_id, type, title, body, meta, read: false, created_at: now() }));
  await Promise.all(notifications.map(notification => db(env).insert("notifications", notification)));
  // The payload is intentionally generic: each browser reloads only its own
  // notification list, so no recipient can observe another user's content.
  await broadcastRealtime(env, { userIds: recipients, event: { type: "notifications_changed" } });
}

export async function broadcastRealtime(env: Env, payload: { sessionId?: string; userId?: string; userIds?: string[]; event: Doc }) {
  try {
    const stub = env.MONGO_GATEWAY.get(env.MONGO_GATEWAY.idFromName("acolhe-mongodb"));
    await stub.fetch("https://realtime.internal/realtime/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    // Realtime is an enhancement. A transient socket/gateway failure must not
    // roll back a valid message or state transition that was already persisted.
    console.error("Realtime broadcast failed", error);
  }
}

export async function listNotificationsPage(env: Env, recipientUserId: string, options: { excludeTypes?: string[]; before?: string; includeUnreadCount?: boolean } = {}) {
  const baseFilter: Doc = { recipient_user_id: recipientUserId };
  if (options.excludeTypes?.length) baseFilter.type = { $nin: options.excludeTypes };
  const filter: Doc = { ...baseFilter };
  let cursorDate = options.before || "";
  let cursorId = "";
  if (options.before?.includes("|")) [cursorDate, cursorId] = options.before.split("|", 2);
  if (cursorDate && Number.isNaN(Date.parse(cursorDate))) { cursorDate = ""; cursorId = ""; }
  if (cursorDate && options.before?.includes("|") && !cursorId) { cursorDate = ""; }
  if (cursorDate && cursorId) filter.$or = [{ created_at: { $lt: cursorDate } }, { created_at: cursorDate, id: { $lt: cursorId } }];
  else if (cursorDate) filter.created_at = { $lt: cursorDate };
  const rows = await db(env).findMany("notifications", filter, { sort: { created_at: -1, id: -1 }, limit: 41 });
  const unread_count = options.includeUnreadCount && !options.before ? await db(env).count("notifications", { ...baseFilter, read: { $ne: true } }) : undefined;
  const items = rows.slice(0, 40);
  const last = items.at(-1);
  return { items, has_more: rows.length > items.length, next_before: last ? `${last.created_at}|${last.id}` : null, ...(typeof unread_count === "number" ? { unread_count } : {}) };
}

export async function listNotifications(env: Env, recipientUserId: string, options: { excludeTypes?: string[] } = {}) {
  return (await listNotificationsPage(env, recipientUserId, options)).items;
}

export async function currentUser(request: Request, env: Env): Promise<Doc | Response> {
  const token = cookieToken(request) || bearerToken(request);
  if (!token) return fail("Não autenticado", 401);
  try {
    const claims = await verifyAccessToken(token, env.JWT_SECRET);
    const user = await db(env).findOne("users", { id: claims.sub }, { password_hash: 0 });
    if (!user) return fail("Usuário não encontrado", 401);
    if (user.active === false) return fail("Acesso desativado", 403);
    if (Number(user.session_version || 0) !== Number(claims.session_version || 0)) return fail("Sessão expirada. Entre novamente.", 401);
    if (user.role !== "admin") {
      if (!user.institution_id) return fail("Instituição não vinculada. Fale com a administração.", 403);
      const institution = await db(env).findOne("institutions", { id: user.institution_id }, { active: 1 });
      if (!institution) return fail("Instituição não vinculada. Fale com a administração.", 403);
      if (institution.active === false) return fail("Instituição arquivada. Fale com a administração.", 403);
    }
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
