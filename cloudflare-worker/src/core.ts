import { bearerToken, cookieToken, type Role, verifyAccessToken } from "./auth";
import { gateway, type Mongo, type RecordDoc } from "./db";
import type { Env } from "./index";
import { logOperational } from "./observability";
import { gatewayObjectName } from "./runtime";
export { logOperational } from "./observability";
export { gatewayObjectName } from "./runtime";

export type Doc = Record<string, any>;
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
export const fail = (detail: string, status: number) => json({ detail }, status);
export const db = (env: Env): Mongo => gateway(env);
export const publicUser = (user: Doc) => ({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active });
export const publicInstitution = (institution: Doc | null) => institution ? ({ id: institution.id, name: institution.name, code: institution.code, plan: institution.plan, active: institution.active !== false }) : null;
export const cookie = (token: string) => ({ "set-cookie": `access_token=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/` });
export const clearCookie = () => ({ "set-cookie": "access_token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/" });

const MAX_JSON_BODY_BYTES = 256 * 1024;

/** Parse JSON request bodies with an explicit size ceiling.  Cloudflare's
 * runtime will accept a much larger body by default, but the application only
 * needs small operational payloads and should reject oversized input before
 * handing it to Mongo or downstream adapters. */
export async function requestBody(request: Request): Promise<Doc | null> {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) return null;
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_JSON_BODY_BYTES) return null;
    const data = JSON.parse(new TextDecoder().decode(raw));
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
  try {
    await db(env).insert("events", { id: id(), type, user_id: user?.id, role: user?.role, institution_id: institutionId || user?.institution_id, meta, created_at: now() });
  } catch (error) {
    // Audit enrichment must never turn a successful user action into a false
    // failure after the primary state transition has already committed.
    logOperational("audit_persistence_failed", { event_type: type, error_name: error instanceof Error ? error.name : "unknown" });
  }
}

const publicNotification = (notification: Doc) => ({ id: notification.id, type: notification.type, title: notification.title, body: notification.body, read: notification.read === true, created_at: notification.created_at, ...(notification.type === "chat_message_received" && notification.meta?.session_id ? { meta: { session_id: String(notification.meta.session_id) } } : {}) });

export async function createNotification(env: Env, recipientUserId: string, type: string, title: string, body: string, meta: Doc = {}) {
  const notification = {
    id: id(), recipient_user_id: recipientUserId, type, title, body, meta,
    email_delivery: { status: "pending", attempts: 0, next_attempt_at: now() },
    read: false, created_at: now(),
  };
  try {
    const dedupeKey = typeof meta.dedupe_key === "string" ? meta.dedupe_key : "";
    const inserted = dedupeKey
      ? await db(env).insertIfAbsent("notifications", { recipient_user_id: recipientUserId, type, "meta.dedupe_key": dedupeKey }, notification, `${recipientUserId}:${type}:${dedupeKey}`)
      : (await db(env).insert("notifications", notification), true);
    if (!inserted) return null;
    const safeNotification = publicNotification(notification);
    await broadcastRealtime(env, { userId: recipientUserId, event: { type: "notification", notification: safeNotification } });
    return notification;
  } catch (error) {
    logOperational("notification_persistence_failed", { notification_type: type, error_name: error instanceof Error ? error.name : "unknown" });
    return null;
  }
}

export async function createNotifications(env: Env, recipientUserIds: string[], type: string, title: string, body: string, meta: Doc = {}) {
  const recipients = [...new Set(recipientUserIds.filter(Boolean))];
  if (!recipients.length) return;
  const notifications = recipients.map(recipient_user_id => ({ id: id(), recipient_user_id, type, title, body, meta, read: false, created_at: now() }));
  const results = await Promise.allSettled(notifications.map(notification => db(env).insert("notifications", notification)));
  if (results.some(result => result.status === "rejected")) logOperational("notification_fanout_partial_failure", { notification_type: type });
  // The payload is intentionally generic: each browser reloads only its own
  // notification list, so no recipient can observe another user's content.
  // Do not wake sockets whose notification write failed; they would refresh
  // needlessly and could miss the event on a transient retry.
  const persistedRecipients = recipients.filter((_, index) => results[index]?.status === "fulfilled");
  if (persistedRecipients.length) await broadcastRealtime(env, { userIds: persistedRecipients, event: { type: "notifications_changed" } });
}

export async function broadcastRealtime(env: Env, payload: { sessionId?: string; userId?: string; userIds?: string[]; institutionId?: string; event: Doc }) {
  try {
    const gatewayName = gatewayObjectName(env.APP_ENV);
    const stub = env.MONGO_GATEWAY.get(env.MONGO_GATEWAY.idFromName(gatewayName));
    await stub.fetch("https://realtime.internal/realtime/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    // Realtime is an enhancement. A transient socket/gateway failure must not
    // roll back a valid message or state transition that was already persisted.
    logOperational("realtime_broadcast_failed", { error_name: error instanceof Error ? error.name : "unknown" });
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
  const store = db(env);
  const [rows, unread_count] = await Promise.all([
    store.findMany("notifications", filter, { sort: { created_at: -1, id: -1 }, limit: 41 }),
    options.includeUnreadCount && !options.before
      ? store.count("notifications", { ...baseFilter, read: { $ne: true } })
      : Promise.resolve(undefined),
  ]);
  const items = rows.slice(0, 40).map(publicNotification);
  const last = items.at(-1);
  return { items, has_more: rows.length > items.length, next_before: last ? `${last.created_at}|${last.id}` : null, ...(typeof unread_count === "number" ? { unread_count } : {}) };
}

export async function listNotifications(env: Env, recipientUserId: string, options: { excludeTypes?: string[] } = {}) {
  return (await listNotificationsPage(env, recipientUserId, options)).items;
}

const authenticatedProfiles = new WeakMap<object, Doc>();

export async function currentUser(request: Request, env: Env): Promise<Doc | Response> {
  const token = cookieToken(request) || bearerToken(request);
  if (!token) return fail("Não autenticado", 401);
  try {
    const claims = await verifyAccessToken(token, env.JWT_SECRET);
    const context = await db(env).getUserContext(String(claims.sub));
    const user = context.user;
    if (!user) return fail("Usuário não encontrado", 401);
    if (user.active === false) return fail("Acesso desativado", 403);
    if (Number(user.session_version || 0) !== Number(claims.session_version || 0)) return fail("Sessão expirada. Entre novamente.", 401);
    if (user.role !== "admin") {
      if (!user.institution_id) return fail("Instituição não vinculada. Fale com a administração.", 403);
      const institution = context.institution;
      if (!institution) return fail("Instituição não vinculada. Fale com a administração.", 403);
      if (institution.active === false) return fail("Instituição arquivada. Fale com a administração.", 403);
    }
    if (context.profile) authenticatedProfiles.set(user, context.profile);
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
  const cached = authenticatedProfiles.get(user);
  if (cached) return cached;
  const collection = user.role === "student" ? "students" : "professionals";
  const result = await db(env).findOne(collection, { user_id: user.id });
  return result || fail("Perfil não encontrado", 404);
}

export function isResponse(value: unknown): value is Response { return value instanceof Response; }
export function asDoc(value: RecordDoc): Doc { return value as Doc; }
