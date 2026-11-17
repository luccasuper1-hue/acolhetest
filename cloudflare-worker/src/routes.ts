import { createAccessToken, hashPassword, verifyPassword } from "./auth";
import { broadcastRealtime, clearCookie, cookie, createNotification, createNotifications, currentUser, db, email, fail, hashToken, id, isResponse, json, listNotifications, listNotificationsPage, logEvent, now, oneOf, profile, publicInstitution, publicUser, requestBody, string, tokenSecret, userWithRole, type Doc } from "./core";
import type { Env } from "./index";

const roles = ["student", "professional", "institution", "admin"] as const;
const fetchExternal = (input: string | URL, init: RequestInit = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) });
const reasonCodes = ["conversar", "dificuldade", "orientacao", "outro"] as const;
const referralStatuses = ["orientacao", "encaminhamento_interno", "encaminhamento_externo", "sem_encaminhamento"] as const;
const meetingModes = ["online", "presencial", "ambos"] as const;
const leadStatuses = ["pending", "approved", "contacted", "rejected", "archived"] as const;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RESPONSE_WINDOW_MS = 48 * 60 * 60 * 1000;
const CHILD_AGE_LIMIT = 12;

const pathParameter = (pathname: string, prefix: string, suffix = "") => pathname.startsWith(prefix) && pathname.endsWith(suffix) ? decodeURIComponent(pathname.slice(prefix.length, suffix ? -suffix.length : undefined)) : undefined;
const isoAfter = (hoursOrDays: number, kind: "hours" | "days") => new Date(Date.now() + hoursOrDays * (kind === "hours" ? 3_600_000 : 86_400_000)).toISOString();
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const validPassword = (value: unknown) => typeof value === "string" && value.length >= 8 && value.length <= 128;
const APP_TIME_ZONE = "America/Fortaleza";
const localScheduleParts = () => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
const localToday = () => { const parts = localScheduleParts(); return `${parts.year}-${parts.month}-${parts.day}`; };
const localCurrentTime = () => { const parts = localScheduleParts(); return `${parts.hour}:${parts.minute}`; };
const scheduleTimestamp = (date: string, time: string) => Date.parse(`${date}T${time}:00-03:00`);
const validDateShape = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const ageOnDate = (birthDate: string) => {
  const birth = new Date(`${birthDate}T00:00:00Z`), today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayPassed = today.getUTCMonth() > birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age;
};
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
const validDate = (value: unknown) => {
  return validDateShape(value) && typeof value === "string" && value >= localToday();
};
const validTime = (value: unknown) => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const sessionHasStarted = (session: Doc) => {
  const today = localToday(), currentTime = localCurrentTime();
  return validDateShape(session.date) && validTime(session.time) && (session.date < today || (session.date === today && session.time <= currentTime));
};
function requestFlowMeta(record: Doc) {
  const status = String(record.status || "pending");
  const createdAt = Date.parse(String(record.created_at || ""));
  const dueAt = Number.isFinite(createdAt) ? new Date(createdAt + RESPONSE_WINDOW_MS).toISOString() : null;
  const age = Number.isFinite(createdAt) ? Date.now() - createdAt : 0;
  const pending = status === "pending";
  const overdue = pending && age >= RESPONSE_WINDOW_MS;
  const dueSoon = pending && !overdue && age >= RESPONSE_WINDOW_MS - 6 * 60 * 60 * 1000;
  if (status === "pending") return { response_due_at: dueAt, response_state: overdue ? "overdue" : dueSoon ? "due_soon" : "waiting", response_overdue: overdue, next_step: overdue ? "Resposta atrasada: procure a instituição para definir o próximo passo." : dueSoon ? "Prazo próximo: o profissional precisa responder." : "Aguardando resposta do profissional." };
  if (status === "proposed") return { response_due_at: dueAt, response_state: "responded", response_overdue: false, next_step: "Confirme o horário proposto." };
  if (status === "accepted" || status === "scheduled") return { response_due_at: dueAt, response_state: "confirmed", response_overdue: false, next_step: "Prepare a conversa e entre na sala no horário." };
  if (status === "completed") return { response_due_at: dueAt, response_state: "completed", response_overdue: false, next_step: "Envie seu feedback e consulte os próximos passos." };
  if (status === "declined" || status === "cancelled" || status === "expired" || status === "no_show") return { response_due_at: dueAt, response_state: status, response_overdue: false, next_step: "Escolha outro horário ou peça orientação à instituição." };
  return { response_due_at: dueAt, response_state: status, response_overdue: false, next_step: "Consulte o status do pedido." };
}
const sortDate = { date: 1 as const, time: 1 as const };
const timeToMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const minutesToTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export async function expirePendingRequests(store: ReturnType<typeof db>, env: Env, institutionId?: string) {
  const filter: Doc = { status: "pending", created_at: { $lt: hoursAgo(48) } };
  if (institutionId) filter.institution_id = institutionId;
  const stale = await store.findMany("requests", filter, { limit: 200 });
  const professionalUserIds = new Set<string>();
  const refreshedInstitutions = new Set<string>();
  let expiredCount = 0;
  for (const record of stale) {
    if (await store.update("requests", { id: record.id, status: "pending" }, { $set: { status: "expired", expired_at: now() } })) {
      expiredCount += 1;
      if (record.institution_id) refreshedInstitutions.add(String(record.institution_id));
      await store.update("availability", { id: record.availability_id, status: "reserved" }, { $set: { status: "open" } });
      const studentUserId = String((await store.findOne("students", { id: record.student_id }, { user_id: 1 }))?.user_id || "");
      if (studentUserId) await notifyUser(env, studentUserId, "request_expired", "Solicitação expirada", "O horário voltou a ficar disponível porque não houve confirmação em até 48 horas.", { request_id: record.id });
      const professionalUserId = String((await store.findOne("professionals", { id: record.professional_id }, { user_id: 1 }))?.user_id || "");
      if (professionalUserId) professionalUserIds.add(professionalUserId);
    }
  }
  const expiringFilter: Doc = { status: "pending", created_at: { $gte: hoursAgo(48), $lt: hoursAgo(36) } };
  if (institutionId) expiringFilter.institution_id = institutionId;
  const expiring = await store.findMany("requests", expiringFilter, { limit: 200 });
  for (const record of expiring) {
    const professional = await store.findOne("professionals", { id: record.professional_id }, { user_id: 1 });
    if (!professional?.user_id) continue;
    const existing = await store.findOne("notifications", { recipient_user_id: professional.user_id, type: "request_expiring", "meta.request_id": record.id });
    if (!existing) await notifyUser(env, String(professional.user_id), "request_expiring", "Solicitação perto de expirar", "Uma solicitação está aguardando sua resposta há mais de 36 horas e expirará em breve.", { request_id: record.id });
  }
  // Direct requests use a separate collection but the same 48-hour contract.
  const directFilter: Doc = { status: "pending", created_at: { $lt: hoursAgo(48) } };
  if (institutionId) directFilter.institution_id = institutionId;
  const staleDirect = await store.findMany("appointment_requests", directFilter, { limit: 200 });
  for (const record of staleDirect) {
    if (await store.update("appointment_requests", { id: record.id, status: "pending" }, { $set: { status: "expired", expired_at: now(), responded_at: now() } })) {
      const studentUserId = String((await store.findOne("students", { id: record.student_id }, { user_id: 1 }))?.user_id || "");
      if (studentUserId) await notifyUser(env, studentUserId, "appointment_request_expired", "Pedido expirado", "Não houve resposta em até 48 horas. Você pode escolher outro profissional ou pedir orientação à instituição.", { appointment_request_id: record.id });
      const professionalUserId = String((await store.findOne("professionals", { id: record.professional_id }, { user_id: 1 }))?.user_id || "");
      if (professionalUserId) await notifyUser(env, professionalUserId, "appointment_request_expired", "Pedido expirado", "Um pedido direto expirou após 48 horas sem resposta.", { appointment_request_id: record.id });
      if (record.institution_id) { await refreshPanels(env, store, String(record.institution_id), "institution"); await refreshPanels(env, store, String(record.institution_id), "admin"); }
      if (record.institution_id) refreshedInstitutions.add(String(record.institution_id));
    }
  }
  if (professionalUserIds.size) await broadcastRealtime(env, { userIds: [...professionalUserIds], event: { type: "data_changed", scope: "professional" } });
  if (expiredCount && institutionId) refreshedInstitutions.add(institutionId);
  await Promise.all([...refreshedInstitutions].map(async (id) => {
    await refreshPanels(env, store, id, "institution");
    await refreshPanels(env, store, id, "admin");
  }));
}

async function sessionReminderNotifications(store: ReturnType<typeof db>, env: Env, sessions: Doc[], userId: string) {
  const nowMs = Date.now();
  const reminders = sessions.filter((session) => session.status === "scheduled" && session.date && session.time).filter((session) => {
    const start = scheduleTimestamp(String(session.date), String(session.time));
    return start > nowMs && start - nowMs <= 24 * 3_600_000;
  });
  for (const session of reminders) {
    const start = scheduleTimestamp(String(session.date), String(session.time)), remaining = start - nowMs;
    const type = remaining <= 60 * 60_000 ? "session_reminder_1h" : "session_reminder_24h";
    const existing = await store.findOne("notifications", { recipient_user_id: userId, type, "meta.session_id": session.id });
    if (!existing) await notifyUser(env, userId, type, remaining <= 60 * 60_000 ? "Conversa em até 1 hora" : "Conversa nas próximas 24 horas", `Sua conversa está marcada para ${session.date.split("-").reverse().join("/")} às ${session.time}.`, { session_id: session.id });
  }
}

function recurringAvailability(startDate: string, weekdays: number[], startTime: string, endTime: string, duration: number, weeks: number) {
  const slots: Array<{ date: string; time: string }> = [];
  for (let offset = 0; offset < weeks * 7; offset += 1) {
    const date = addDays(startDate, offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (!weekdays.includes(weekday)) continue;
    for (let minute = timeToMinutes(startTime); minute + duration <= timeToMinutes(endTime); minute += duration) {
      slots.push({ date, time: minutesToTime(minute) });
    }
  }
  return slots;
}

function base64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sendGmail(env: Env, recipient: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) return false;
  try {
    const tokenResponse = await fetchExternal("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GMAIL_CLIENT_ID,
        client_secret: env.GMAIL_CLIENT_SECRET,
        refresh_token: env.GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenResponse.ok) { console.error("Gmail token exchange failed", tokenResponse.status); return false; }
    const token = await tokenResponse.json<{ access_token?: string }>();
    if (!token.access_token) return false;
    const from = env.GMAIL_FROM || "acolheiluminado@gmail.com";
    const mime = [
      `From: Acolhe <${from}>`,
      `To: ${recipient}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: multipart/alternative; boundary=acolhe_boundary",
      "",
      "--acolhe_boundary",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      text,
      "--acolhe_boundary",
      "Content-Type: text/html; charset=UTF-8",
      "",
      html,
      "--acolhe_boundary--",
    ].join("\r\n");
      const response = await fetchExternal("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: base64Url(mime) }),
    });
    if (!response.ok) console.error("Gmail send failed", response.status, (await response.text()).slice(0, 300));
    return response.ok;
  } catch (error) { console.error("Gmail send error", error); return false; }
}

async function sendResetEmail(env: Env, recipient: string, token: string): Promise<boolean> {
  let frontend: URL;
  try {
    frontend = new URL(env.FRONTEND_URL);
  } catch { console.error("Reset email misconfigured: invalid FRONTEND_URL"); return false; }
  if (frontend.protocol !== "https:" || frontend.pathname !== "/" || frontend.search || frontend.hash) { console.error("Reset email misconfigured: FRONTEND_URL must be the site origin"); return false; }
  const resetUrl = `${frontend.origin}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const subject = "Redefinir senha do Acolhe";
  const text = `Para redefinir sua senha, abra este link em até 1 hora:\n\n${resetUrl}\n`;
  const logoUrl = `${frontend.origin}/brand-mark.png`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head><body style="margin:0;background:#f7f4fb;color:#30243f;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:0 auto;padding:36px 20px"><div style="background:#fff;border:1px solid #e5dcef;border-radius:24px;padding:36px;box-shadow:0 12px 30px rgba(59,36,93,.08)"><div style="margin-bottom:28px"><img src="${logoUrl}" width="34" height="34" alt="" style="vertical-align:middle;margin-right:8px"><span style="font-size:22px;font-weight:700;color:#52358d;vertical-align:middle">Acolhe</span></div><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7650c8;font-weight:700;margin-bottom:12px">Acesso ao piloto</div><h1 style="font-size:30px;line-height:1.15;font-weight:500;margin:0 0 16px;color:#30243f">Recuperar acesso.</h1><p style="font-size:16px;line-height:1.55;color:#716780;margin:0 0 26px">Recebemos uma solicitação para redefinir a senha da sua conta no Acolhe.</p><a href="${resetUrl}" style="display:inline-block;background:#7650c8;color:#fff;text-decoration:none;font-size:16px;font-weight:700;border-radius:999px;padding:15px 26px">Redefinir minha senha&nbsp; →</a><p style="font-size:13px;line-height:1.5;color:#81758f;margin:26px 0 0">Este link expira em 1 hora. Se você não fez esta solicitação, pode ignorar este e-mail.</p></div><p style="font-size:12px;text-align:center;color:#81758f;margin:18px 0 0">Acolhe · um primeiro passo para buscar apoio</p></div></body></html>`;
  if (env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN && await sendGmail(env, recipient, subject, text, html)) return true;
  if (env.RESET_EMAIL_WEBHOOK_URL && env.RESET_EMAIL_WEBHOOK_TOKEN) {
    let endpoint: URL;
    try { endpoint = new URL(env.RESET_EMAIL_WEBHOOK_URL); } catch { return false; }
    if (endpoint.protocol !== "https:") return false;
    try {
      const response = await fetchExternal(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESET_EMAIL_WEBHOOK_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ to: recipient, subject, text }),
      });
      return response.ok;
    } catch { return false; }
  }
  if (!env.RESEND_API_KEY) { console.error("Reset email misconfigured: no Gmail API or Resend credentials"); return false; }
  try {
    const response = await fetchExternal("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: env.RESEND_FROM || "Acolhe <onboarding@resend.dev>", to: [recipient], subject, text, html }),
    });
    if (!response.ok) console.error("Resend reset failed", response.status, (await response.text()).slice(0, 500));
    return response.ok;
  } catch { return false; }
}

async function sendNotificationEmail(env: Env, recipient: string, subject: string, text: string): Promise<boolean> {
  let frontendOrigin = "";
  try { frontendOrigin = new URL(env.FRONTEND_URL).origin; } catch { return false; }
  const logoUrl = `${frontendOrigin}/brand-mark.png`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f7f4fb;color:#30243f;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:0 auto;padding:36px 20px"><div style="background:#fff;border:1px solid #e5dcef;border-radius:24px;padding:36px"><div style="margin-bottom:28px"><img src="${escapeHtml(logoUrl)}" width="34" height="34" alt="" style="vertical-align:middle;margin-right:8px"><span style="font-size:22px;font-weight:700;color:#52358d;vertical-align:middle">Acolhe</span></div><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7650c8;font-weight:700;margin-bottom:12px">Atualização do piloto</div><h1 style="font-size:28px;line-height:1.15;font-weight:500;margin:0 0 16px;color:#30243f">${escapeHtml(subject)}</h1><p style="font-size:16px;line-height:1.55;color:#716780;white-space:pre-wrap;margin:0">${escapeHtml(text)}</p><p style="font-size:13px;line-height:1.5;color:#81758f;margin:26px 0 0">Entre no Acolhe para ver os detalhes. Evitamos incluir conteúdo sensível neste e-mail.</p></div><p style="font-size:12px;text-align:center;color:#81758f;margin:18px 0 0">Acolhe · um primeiro passo para buscar apoio</p></div></body></html>`;
  if (env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN && await sendGmail(env, recipient, subject, text, html)) return true;
  if (!env.RESEND_API_KEY) return false;
  try {
    const response = await fetchExternal("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: env.RESEND_FROM || "Acolhe <onboarding@resend.dev>", to: [recipient], subject: `Acolhe · ${subject}`, text, html }) });
    if (!response.ok) console.error("Resend notification failed", response.status);
    return response.ok;
  } catch (error) { console.error("Notification email error", error); return false; }
}

async function notifyUser(env: Env, recipientUserId: string, type: string, title: string, body: string, meta: Doc = {}) {
  if (!recipientUserId) return;
  await createNotification(env, recipientUserId, type, title, body, meta);
  const account = await db(env).findOne("users", { id: recipientUserId }, { email: 1 });
  if (account?.email) await sendNotificationEmail(env, String(account.email), title, body);
}

async function notifyInstitutionManagers(env: Env, store: ReturnType<typeof db>, institutionId: string, type: string, title: string, body: string, meta: Doc = {}) {
  const managers = await store.findMany("users", { role: "institution", institution_id: institutionId, active: { $ne: false } }, { projection: { id: 1, email: 1 }, limit: 20 });
  const ids = [...new Set(managers.map(manager => String(manager.id)).filter(Boolean))];
  await createNotifications(env, ids, type, title, body, meta);
  await Promise.all(managers.filter(manager => manager.email).map(manager => sendNotificationEmail(env, String(manager.email), title, body)));
}

async function notifyAdmins(env: Env, store: ReturnType<typeof db>, type: string, title: string, body: string, meta: Doc = {}) {
  const admins = await store.findMany("users", { role: "admin", active: { $ne: false } }, { projection: { id: 1, email: 1 }, limit: 50 });
  const ids = [...new Set(admins.map(admin => String(admin.id)).filter(Boolean))];
  await createNotifications(env, ids, type, title, body, meta);
  await Promise.all(admins.filter(admin => admin.email).map(admin => sendNotificationEmail(env, String(admin.email), title, body)));
}

async function refreshPanels(env: Env, store: ReturnType<typeof db>, institutionId: string, scope: "institution" | "admin" = "institution") {
  const users = scope === "institution"
    ? await store.findMany("users", { role: "institution", institution_id: institutionId, active: { $ne: false } }, { projection: { id: 1 }, limit: 20 })
    : await store.findMany("users", { role: "admin", active: { $ne: false } }, { projection: { id: 1 }, limit: 50 });
  const userIds = [...new Set(users.map(account => String(account.id)).filter(Boolean))];
  if (userIds.length) await broadcastRealtime(env, { userIds, event: { type: "data_changed", scope } });
}

async function refreshStudentPanels(env: Env, store: ReturnType<typeof db>, institutionId: string) {
  const students = await store.findMany("students", { institution_id: institutionId }, { projection: { user_id: 1 }, limit: 500 });
  const userIds = [...new Set(students.map(student => String(student.user_id)).filter(Boolean))];
  if (userIds.length) await broadcastRealtime(env, { userIds, event: { type: "data_changed", scope: "student" } });
}

async function refreshProfessionalPanel(env: Env, store: ReturnType<typeof db>, professionalId: string) {
  const professional = await store.findOne("professionals", { id: professionalId }, { user_id: 1 });
  if (professional?.user_id) await broadcastRealtime(env, { userIds: [String(professional.user_id)], event: { type: "data_changed", scope: "professional" } });
}

async function notifyWaitingStudents(env: Env, store: ReturnType<typeof db>, institutionId: string, count: number) {
  const interests = await store.findMany("availability_interests", { institution_id: institutionId, status: "waiting" }, { projection: { student_id: 1 }, limit: 500 });
  const students = interests.length ? await store.findMany("students", { id: { $in: interests.map(interest => interest.student_id) } }, { projection: { user_id: 1 }, limit: 500 }) : [];
  const userIds = [...new Set(students.map(student => String(student.user_id || "")).filter(Boolean))];
  await Promise.all(userIds.map(userId => notifyUser(env, userId, "availability_published_for_request", "Novos horários organizados", `${count} novo${count === 1 ? "" : "s"} horário${count === 1 ? " foi" : "s foram"} organizado${count === 1 ? "" : "s"} por um profissional. Se quiser conversar, envie um pedido diretamente pelo painel.`)));
}

async function sendLead(request: Request, env: Env, kind: "institution" | "professional") {
  const payload = await requestBody(request);
  const name = string(payload?.nome), address = email(payload?.email), message = string(payload?.mensagem);
  const institution = string(payload?.instituicao), cargo = string(payload?.cargo), students = string(payload?.estudantes);
  const managerPassword = payload?.senha;
  const profession = string(payload?.profissao), registration = string(payload?.registro), area = string(payload?.area), region = string(payload?.regiao);
  const validInstitution = institution.length >= 2 && institution.length <= 160 && cargo.length >= 2 && cargo.length <= 120 && students.length <= 40;
  const validProfessional = profession.length >= 2 && profession.length <= 120 && registration.length <= 120 && area.length <= 160 && region.length <= 120;
  if (name.length < 2 || name.length > 120 || !address || message.length > 2000 || (kind === "institution" ? !validInstitution || !validPassword(managerPassword) || message.trim().length < 10 : !validProfessional)) {
    return fail("Dados do contato inválidos", 422);
  }
  if (kind === "institution" && await db(env).findOne("users", { email: address }, { id: 1 })) {
    return fail("Este e-mail já possui uma conta. Use um e-mail exclusivo para o gestor institucional.", 409);
  }
  if (!env.RESEND_API_KEY || !env.LEAD_EMAIL_TO) return fail("Envio de contatos ainda não está configurado", 503);
  const lead = { id: id(), kind, status: "pending", name, email: address, message: message || null, created_at: now(), ...(kind === "institution" ? { institution, cargo: cargo || null, students: students || null, manager_password_hash: await hashPassword(String(managerPassword)) } : { profession, registration: registration || null, area: area || null, region: region || null }) };
  await db(env).insert("leads", lead);
  await notifyAdmins(env, db(env), "lead_received", "Novo interesse recebido", `Há um novo interesse ${kind === "institution" ? "institucional" : "profissional"} aguardando revisão.`, { lead_id: lead.id, kind });
  const subject = kind === "institution" ? `Novo interesse institucional — ${institution}` : `Novo interesse profissional — ${name}`;
  const text = kind === "institution"
    ? [`Nome: ${name}`, `Cargo: ${cargo || "—"}`, `Instituição: ${institution}`, `E-mail: ${address}`, `Estudantes: ${students || "—"}`, "", `Mensagem:\n${message}`].join("\n")
    : [`Nome: ${name}`, `Profissão: ${profession}`, `Registro: ${registration || "—"}`, `E-mail: ${address}`, `Área: ${area || "—"}`, `Região: ${region || "—"}`, "", message ? `Mensagem:\n${message}` : "Sem mensagem adicional."].join("\n");
  const logoUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/brand-mark.png`;
  const details = kind === "institution"
    ? `<div style="margin:24px 0 0;padding:18px 20px;background:#f7f4fb;border:1px solid #e5dcef;border-radius:16px"><p style="margin:0 0 10px;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">Nome</strong><br>${escapeHtml(name)}</p><p style="margin:0 0 10px;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">Cargo</strong><br>${escapeHtml(cargo)}</p><p style="margin:0 0 10px;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">Instituição</strong><br>${escapeHtml(institution)}</p><p style="margin:0 0 10px;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">E-mail</strong><br><a href="mailto:${escapeHtml(address)}" style="color:#7650c8">${escapeHtml(address)}</a></p><p style="margin:0;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">Estudantes</strong><br>${escapeHtml(students || "—")}</p></div>`
    : `<div style="margin:24px 0 0;padding:18px 20px;background:#f7f4fb;border:1px solid #e5dcef;border-radius:16px"><p style="margin:0 0 10px;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">Nome</strong><br>${escapeHtml(name)}</p><p style="margin:0 0 10px;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">Profissão</strong><br>${escapeHtml(profession)}</p><p style="margin:0 0 10px;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">E-mail</strong><br><a href="mailto:${escapeHtml(address)}" style="color:#7650c8">${escapeHtml(address)}</a></p><p style="margin:0 0 10px;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">Área de atuação</strong><br>${escapeHtml(area || "—")}</p><p style="margin:0;font-size:13px;line-height:1.45;color:#81758f"><strong style="color:#52358d">Região</strong><br>${escapeHtml(region || "—")}</p></div>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f7f4fb;color:#30243f;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:0 auto;padding:36px 20px"><div style="background:#fff;border:1px solid #e5dcef;border-radius:24px;padding:36px;box-shadow:0 12px 30px rgba(59,36,93,.08)"><div style="margin-bottom:28px"><img src="${escapeHtml(logoUrl)}" width="34" height="34" alt="" style="vertical-align:middle;margin-right:8px"><span style="font-size:22px;font-weight:700;color:#52358d;vertical-align:middle">Acolhe</span></div><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7650c8;font-weight:700;margin-bottom:12px">Operação do piloto</div><h1 style="font-size:30px;line-height:1.15;font-weight:500;margin:0 0 16px;color:#30243f">Novo interesse ${kind === "institution" ? "institucional" : "profissional"}.</h1><p style="font-size:16px;line-height:1.55;color:#716780;margin:0">Recebemos um novo contato para análise no painel do Acolhe.</p>${details}<div style="margin-top:18px;padding:18px 20px;border-left:4px solid #7650c8;background:#fbf9fe;border-radius:12px"><div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#7650c8;font-weight:700;margin-bottom:8px">Mensagem</div><div style="font-size:15px;line-height:1.6;color:#716780;white-space:pre-wrap">${escapeHtml(message)}</div></div></div><p style="font-size:12px;text-align:center;color:#81758f;margin:18px 0 0">Acolhe · um primeiro passo para buscar apoio</p></div></body></html>`;
  const response = await fetchExternal("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    // Mantém a versão em texto para clientes simples e envia uma versão visual alinhada ao e-mail de recuperação.
    body: JSON.stringify({
      from: env.RESEND_FROM || "Acolhe <onboarding@resend.dev>",
      to: [env.LEAD_EMAIL_TO],
      reply_to: address,
      subject,
      text,
      html,
    }),
  });
  if (!response.ok) {
    console.error("Resend lead failed", response.status);
    // The lead and the in-app admin notification are already persisted. Do
    // not report a failed submission that would make the user retry it and
    // create duplicates just because the secondary email channel is down.
    return json({ ok: true, id: lead.id, notification_pending: true }, 201);
  }
  return json({ ok: true, id: lead.id }, 201);
}

async function getStudent(request: Request, env: Env) {
  const user = await userWithRole(request, env, ["student"]); if (isResponse(user)) return user;
  const student = await profile(env, user); return isResponse(student) ? student : { user, student };
}
async function getProfessional(request: Request, env: Env) {
  const user = await userWithRole(request, env, ["professional"]); if (isResponse(user)) return user;
  const professional = await profile(env, user); return isResponse(professional) ? professional : { user, professional };
}
async function getInstitution(request: Request, env: Env) {
  const user = await userWithRole(request, env, ["institution"]); if (isResponse(user)) return user;
  const institution = await db(env).findOne("institutions", { id: user.institution_id });
  return institution ? { user, institution } : fail("Instituição não vinculada", 404);
}

async function register(request: Request, env: Env) {
  const payload = await requestBody(request); if (!payload) return fail("Corpo JSON inválido", 422);
  const name = string(payload.name), address = email(payload.email), password = payload.password, code = string(payload.institution_code).toUpperCase();
  const birthDate = string(payload.birth_date), age = validDateShape(birthDate) ? ageOnDate(birthDate) : -1;
  const guardianName = string(payload.guardian_name), guardianEmail = email(payload.guardian_email);
  if (name.length < 2 || name.length > 90 || !address || !validPassword(password) || code.length < 3 || code.length > 40 || age < 0 || age > 120) return fail("Dados de cadastro inválidos", 422);
  if (payload.consent !== true) return fail("É necessário aceitar os termos de uso do piloto", 422);
  const consentVersion = string(payload.consent_version) || "pilot-v1";
  const consentRole = string(payload.consent_role) || "student";
  if (consentVersion !== "pilot-v1") return fail("A versão dos termos não é mais válida. Atualize a página e tente novamente.", 422);
  if (consentRole !== "student") return fail("O perfil do termo aceito não corresponde a este cadastro.", 422);
  const isChild = age < CHILD_AGE_LIMIT;
  if (isChild && (payload.guardian_consent !== true || guardianName.length < 2 || !guardianEmail || guardianEmail === address)) return fail("Crianças precisam de autorização de um responsável legal antes de acessar o Acolhe.", 422);
  const store = db(env), institution = await store.findOne("institutions", { code, active: { $ne: false } });
  if (!institution) return fail("Código de instituição não encontrado", 404);
  if (await store.findOne("users", { email: address }, { id: 1 })) return fail("Este e-mail já possui conta", 409);
  const user = { id: id(), name, email: address, password_hash: await hashPassword(password as string), role: "student", institution_id: institution.id, active: !isChild, session_version: 0, consent_role: consentRole, consent_version: consentVersion, consent_accepted_at: now(), birth_date: birthDate, age_band: isChild ? "child" : age < 18 ? "adolescent" : "adult", guardian_name: isChild ? guardianName : null, guardian_email: isChild ? guardianEmail : null, guardian_consent_at: isChild ? now() : null, guardian_review_status: isChild ? "pending_institution_review" : null, created_at: now() };
  const student = { id: id(), user_id: user.id, institution_id: institution.id, created_at: now(), last_access: null };
  try {
    await store.insert("users", user);
    await store.insert("students", student);
  } catch (error) {
    await store.remove("students", { id: student.id }, true);
    await store.remove("users", { id: user.id }, true);
    console.error("Student registration rolled back", error);
    return fail("Não foi possível concluir o cadastro. Tente novamente.", 503);
  }
  await logEvent(env, "student_registered", user, institution.id);
  if (isChild) {
    await notifyInstitutionManagers(env, store, institution.id, "minor_registration_review", "Cadastro de criança aguardando validação", "Uma criança solicitou acesso ao Acolhe. Valide o responsável legal conforme a política da instituição antes de liberar o acesso.", { user_id: user.id });
    await sendNotificationEmail(env, address, "Cadastro recebido no Acolhe", "Seu cadastro foi recebido e aguarda a validação da instituição e do responsável legal antes de liberar o acesso.");
    return json({ pending_guardian: true, message: "Cadastro recebido. A instituição precisa validar o responsável legal antes de liberar o acesso." }, 202);
  }
  await sendNotificationEmail(env, address, "Cadastro concluído no Acolhe", `Sua conta de estudante foi criada e já está ativa na instituição ${institution.name}.`);
  const accessToken = await createAccessToken({ sub: user.id, email: address, role: "student", session_version: 0 }, env.JWT_SECRET);
  return json({ user: publicUser(user), institution: publicInstitution(institution) }, 200, cookie(accessToken));
}

async function login(request: Request, env: Env) {
  const payload = await requestBody(request); if (!payload) return fail("Corpo JSON inválido", 422);
  const address = email(payload.email), password = payload.password;
  if (!address || typeof password !== "string" || password.length > 128) return fail("Dados de acesso inválidos", 422);
  const store = db(env), attempt = await store.findOne("login_attempts", { identifier: address });
  if (attempt?.locked_until && String(attempt.locked_until) > now()) return fail("Muitas tentativas. Tente novamente em alguns minutos.", 429);
  const user = await store.findOne("users", { email: address });
  if (user && !user.password_hash) return fail("Convite pendente. Defina sua senha pelo link recebido da instituição.", 403);
  if (!user || !(await verifyPassword(password, String(user.password_hash)))) {
    const count = Number(attempt?.count || 0) + 1;
    const patch: Doc = { identifier: address, count: count >= MAX_LOGIN_ATTEMPTS ? 0 : count, updated_at: now() };
    if (count >= MAX_LOGIN_ATTEMPTS) patch.locked_until = minutesFromNow(LOCK_MINUTES);
    await store.update("login_attempts", { identifier: address }, { $set: patch }, true);
    return fail("E-mail ou senha inválidos", 401);
  }
  if (user.active === false) return fail("Acesso desativado. Fale com a instituição.", 403);
  if (!roles.includes(user.role)) return fail("Perfil inválido", 403);
  const loginInstitution = user.institution_id ? await store.findOne("institutions", { id: user.institution_id }) : null;
  if (user.role !== "admin" && !loginInstitution) return fail("Instituição não vinculada. Fale com a administração.", 403);
  if (user.role !== "admin" && loginInstitution?.active === false) return fail("Instituição arquivada. Fale com a administração.", 403);
  await Promise.all([
    store.remove("login_attempts", { identifier: address }),
    user.role === "student"
      ? store.update("students", { user_id: user.id }, { $set: { last_access: now() } })
      : user.role === "professional"
        ? store.update("professionals", { user_id: user.id }, { $set: { last_access: now() } })
        : Promise.resolve(0),
  ]);
  await logEvent(env, "access", user, user.institution_id);
  const accessToken = await createAccessToken({ sub: user.id, email: address, role: user.role, session_version: Number(user.session_version || 0) }, env.JWT_SECRET);
  return json({ user: publicUser(user), institution: user.role === "institution" ? loginInstitution : publicInstitution(loginInstitution) }, 200, cookie(accessToken));
}

async function authRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  const store = db(env);
  if (pathname === "/api/auth/register" && request.method === "POST") return register(request, env);
  if (pathname === "/api/auth/login" && request.method === "POST") return login(request, env);
  if (pathname === "/api/auth/logout" && request.method === "POST") return json({ ok: true }, 200, clearCookie());
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = await currentUser(request, env); if (isResponse(user)) return user;
    const institution = user.institution_id ? await store.findOne("institutions", { id: user.institution_id }) : null;
    return json({ user: publicUser(user), institution: user.role === "institution" ? institution : publicInstitution(institution) });
  }
  if (pathname === "/api/auth/account" && request.method === "DELETE") {
    const user = await currentUser(request, env); if (isResponse(user)) return user;
    if (user.role === "admin") return fail("A conta administrativa deve ser gerenciada pela operação", 403);
    const payload = await requestBody(request);
    if (String(payload?.confirmation || "").trim().toUpperCase() !== "EXCLUIR") return fail("Digite EXCLUIR para confirmar", 422);
    if (!validPassword(payload?.current_password)) return fail("Informe sua senha atual", 422);
    const stored = await store.findOne("users", { id: user.id });
    if (!stored || !(await verifyPassword(String(payload?.current_password), String(stored.password_hash)))) return fail("Senha atual incorreta", 401);
    const deleted = await store.deleteAccount(user.id, { kind: "self" });
    if (!deleted) return fail("Conta não encontrada", 404);
    return json({ ok: true, deleted: true }, 200, clearCookie());
  }
  if (pathname === "/api/auth/change-password" && request.method === "POST") {
    const user = await currentUser(request, env); if (isResponse(user)) return user;
    const payload = await requestBody(request), currentPassword = payload?.current_password, newPassword = payload?.new_password;
    if (!validPassword(currentPassword) || !validPassword(newPassword)) return fail("Informe a senha atual e uma nova senha com pelo menos 8 caracteres", 422);
    if (currentPassword === newPassword) return fail("A nova senha precisa ser diferente da atual", 422);
    const stored = await store.findOne("users", { id: user.id });
    if (!stored || !(await verifyPassword(String(currentPassword), String(stored.password_hash)))) return fail("Senha atual incorreta", 401);
    await store.update("users", { id: user.id }, { $set: { password_hash: await hashPassword(String(newPassword)), password_changed_at: now(), session_version: Number(user.session_version || 0) + 1 } });
    await sendNotificationEmail(env, String(user.email), "Senha alterada", "A senha da sua conta no Acolhe foi alterada com sucesso. Se você não fez essa alteração, entre em contato com a administração.");
    await logEvent(env, "password_changed", user, user.institution_id);
    return json({ ok: true });
  }
  const inviteToken = pathParameter(pathname, "/api/auth/invite/");
  if (inviteToken && request.method === "GET") {
    const user = await store.findOne("users", { invite_token: inviteToken });
    if (!user) return fail("Convite inválido ou já utilizado", 404);
    if (user.invite_expires_at && String(user.invite_expires_at) < now()) { if (user.institution_id) await notifyInstitutionManagers(env, store, String(user.institution_id), "invite_expired", "Convite expirado", `O convite de ${user.name} expirou. Gere um novo convite se ainda for necessário.`, { user_id: user.id }); return fail("Convite expirado. Peça um novo à instituição.", 410); }
    const institution = await store.findOne("institutions", { id: user.institution_id });
    if (institution?.active === false) return fail("Instituição arquivada. Fale com a administração.", 403);
    return json({ name: user.name, email: user.email, role: user.role, institution: institution?.name });
  }
  const acceptToken = pathParameter(pathname, "/api/auth/invite/", "/accept");
  if (acceptToken && request.method === "POST") {
    const payload = await requestBody(request); if (!payload || !validPassword(payload.password)) return fail("Senha inválida", 422);
    const user = await store.findOne("users", { invite_token: acceptToken });
    if (!user) return fail("Convite inválido ou já utilizado", 404);
    if (user.invite_expires_at && String(user.invite_expires_at) < now()) { if (user.institution_id) await notifyInstitutionManagers(env, store, String(user.institution_id), "invite_expired", "Convite expirado", `O convite de ${user.name} expirou. Gere um novo convite se ainda for necessário.`, { user_id: user.id }); return fail("Convite expirado. Peça um novo à instituição.", 410); }
    const inviteInstitution = await store.findOne("institutions", { id: user.institution_id }, { active: 1 });
    if (inviteInstitution?.active === false) return fail("Instituição arquivada. Fale com a administração.", 403);
    const changed = await store.update("users", { id: user.id, invite_token: acceptToken }, { $set: { password_hash: await hashPassword(payload.password), active: true, session_version: Number(user.session_version || 0), consent_accepted_at: now() }, $unset: { invite_token: "", invite_expires_at: "" } });
    if (changed !== 1) return fail("Convite inválido ou já utilizado", 404);
    await notifyInstitutionManagers(env, store, String(user.institution_id), "professional_invite_accepted", "Convite aceito", `${user.name} aceitou o convite e já pode atuar no Acolhe.`, { user_id: user.id });
    await refreshPanels(env, store, String(user.institution_id), "admin");
    await logEvent(env, "invite_accepted", user, user.institution_id);
    const accessToken = await createAccessToken({ sub: user.id, email: user.email, role: user.role, session_version: Number(user.session_version || 0) }, env.JWT_SECRET);
    return json({ user: publicUser({ ...user, active: true }) }, 200, cookie(accessToken));
  }
  if (pathname === "/api/auth/forgot-password" && request.method === "POST") {
    const payload = await requestBody(request), address = email(payload?.email); if (!address) return fail("E-mail inválido", 422);
    const pilotReset = env.PILOT_RETURN_RESET_TOKEN === "true" && Boolean(env.APP_ENV) && env.APP_ENV !== "production";
    const emailEnabled = Boolean(
      (env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN) ||
      (env.RESET_EMAIL_WEBHOOK_URL && env.RESET_EMAIL_WEBHOOK_TOKEN) ||
      env.RESEND_API_KEY,
    );
    const generic: Doc = { ok: true, message: "Se o e-mail existir, as instruções de redefinição serão enviadas." };
    const user = await store.findOne("users", { email: address }); if (!user) return json(generic);
    if (!pilotReset && !emailEnabled) { console.error("Password recovery provider is not configured"); return json(generic); }
    const resetToken = tokenSecret();
    // Keep one active request per account and repair records created by the
    // earlier pilot schema in-place. Upsert avoids duplicate-key failures on
    // retries and is safe when two requests arrive close together.
    await store.update("password_reset_tokens", { user_id: user.id }, {
      $set: {
        id: id(),
        user_id: user.id,
        // Compatibility value for the original unique `token` index. The
        // usable reset token is never stored in plaintext.
        token: id(),
        token_hash: await hashToken(resetToken),
        expires_at: isoAfter(1, "hours"),
        used: false,
        created_at: now(),
      },
    }, true);
    if (pilotReset) return json({ ...generic, reset_token: resetToken, pilot_note: "PROVISÓRIO PARA PILOTO: envio por e-mail é P1." });
    const sent = await sendResetEmail(env, address, resetToken);
    if (!sent) {
      // Keep the response non-enumerating: do not reveal whether this
      // address belongs to an account, but do not claim delivery either.
      console.error("Reset email was not delivered");
    }
    return json(generic);
  }
  if (pathname === "/api/auth/reset-password" && request.method === "POST") {
    const payload = await requestBody(request); if (!payload || !string(payload.token) || !validPassword(payload.password)) return fail("Dados inválidos", 422);
    const reset = await store.findOneAndUpdate("password_reset_tokens", { token_hash: await hashToken(string(payload.token)), used: false, expires_at: { $gt: now() } }, { $set: { used: true } });
    if (!reset) return fail("Link inválido ou expirado", 400);
    const user = await store.findOne("users", { id: reset.user_id });
    if (!user) return fail("Link inválido ou expirado", 400);
    await store.update("users", { id: reset.user_id }, { $set: { password_hash: await hashPassword(payload.password), password_changed_at: now(), session_version: Number(user.session_version || 0) + 1 } });
    await sendNotificationEmail(env, String(user.email), "Senha redefinida", "A senha da sua conta no Acolhe foi redefinida com sucesso. Se você não fez essa alteração, entre em contato com a administração.");
    return json({ ok: true });
  }
  return undefined;
}

async function publicRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (request.method === "POST" && pathname === "/api/leads/institution") return sendLead(request, env, "institution");
  if (request.method === "POST" && pathname === "/api/leads/professional") return sendLead(request, env, "professional");
  const certificateCode = pathParameter(pathname, "/api/certificates/");
  if (certificateCode && request.method === "GET") {
    const certificate = await db(env).findOne("certificates", { code: certificateCode, status: "valid" });
    return certificate ? json({ valid: true, certificate: { code: certificate.code, professional_name: certificate.professional_name, institution_name: certificate.institution_name, completed_count: certificate.completed_count, issued_at: certificate.issued_at, title: certificate.title } }) : fail("Certificado não encontrado", 404);
  }
  return undefined;
}

async function studentProfessionals(store: ReturnType<typeof db>, student: Doc) {
  const professionals = await store.findMany("professionals", { institution_id: student.institution_id }, { limit: 100 });
  const userIds = professionals.map((professional) => professional.user_id), professionalIds = professionals.map((professional) => professional.id);
  const [accounts, slots] = await Promise.all([
    userIds.length ? store.findMany("users", { id: { $in: userIds } }, { projection: { id: 1, name: 1, active: 1 }, limit: 100 }) : Promise.resolve([]),
    professionalIds.length ? store.findMany("availability", { professional_id: { $in: professionalIds }, status: "open", date: { $gte: localToday() } }, { sort: sortDate, limit: 500 }) : Promise.resolve([]),
  ]);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const slotsByProfessional = new Map<string, Doc[]>();
  for (const slot of slots) { const list = slotsByProfessional.get(slot.professional_id) || []; list.push(slot); slotsByProfessional.set(slot.professional_id, list); }
  return professionals.flatMap((professional) => { const account = accountById.get(professional.user_id); return !account || account.active === false ? [] : [{ id: professional.id, name: account.name, specialty: professional.specialty, link_type: professional.link_type, slots: (slotsByProfessional.get(professional.id) || []).map(slot => ({ ...slot, mode: meetingModes.includes(slot.mode) ? slot.mode : "online", location: slot.location || null })) }]; });
}

async function studentRequests(store: ReturnType<typeof db>, student: Doc) {
  const records = await store.findMany("requests", { student_id: student.id }, { sort: sortDate, limit: 200 });
  const professionalIds = records.map((record) => record.professional_id), requestIds = records.map((record) => record.id);
  const [professionals, sessions] = await Promise.all([
    professionalIds.length ? store.findMany("professionals", { id: { $in: professionalIds } }, { projection: { id: 1, user_id: 1 }, limit: 200 }) : Promise.resolve([]),
    requestIds.length ? store.findMany("sessions", { request_id: { $in: requestIds } }, { limit: 200 }) : Promise.resolve([]),
  ]);
  const userIds = professionals.map((professional) => professional.user_id);
  const [accounts, referrals, feedback] = await Promise.all([
    userIds.length ? store.findMany("users", { id: { $in: userIds } }, { projection: { id: 1, name: 1 }, limit: 200 }) : Promise.resolve([]),
    sessions.length ? store.findMany("referrals", { session_id: { $in: sessions.map((session) => session.id) } }, { limit: 200 }) : Promise.resolve([]),
    sessions.length ? store.findMany("feedback", { session_id: { $in: sessions.map((session) => session.id) } }, { limit: 200 }) : Promise.resolve([]),
  ]);
  const proById = new Map(professionals.map((professional) => [professional.id, professional]));
  const accountById = new Map(accounts.map((account) => [account.id, account.name]));
  const sessionByRequest = new Map(sessions.map((session) => [session.request_id, session]));
  const referralBySession = new Map(referrals.map((referral) => [referral.session_id, referral]));
  const feedbackBySession = new Map(feedback.map((entry) => [entry.session_id, entry]));
  return records.map((record) => { const pro = proById.get(record.professional_id), session = sessionByRequest.get(record.id); return { ...record, ...requestFlowMeta(record), professional_name: pro ? accountById.get(pro.user_id) || "Profissional" : "Profissional", session: session || null, referral: session ? referralBySession.get(session.id) || null : null, feedback: session ? feedbackBySession.get(session.id) || null : null }; });
}

async function studentAvailabilityInterest(store: ReturnType<typeof db>, student: Doc) {
  return store.findOne("availability_interests", { student_id: student.id, status: "waiting" }, { id: 1, reason_code: 1, created_at: 1, status: 1 });
}

async function studentAppointmentRequests(store: ReturnType<typeof db>, student: Doc) {
  const records = await store.findMany("appointment_requests", { student_id: student.id }, { sort: { created_at: -1 }, limit: 100 });
  const professionalIds = records.map((record) => record.professional_id);
  const professionals = professionalIds.length ? await store.findMany("professionals", { id: { $in: professionalIds } }, { projection: { id: 1, user_id: 1 }, limit: 100 }) : [];
  const accounts = professionals.length ? await store.findMany("users", { id: { $in: professionals.map((professional) => professional.user_id) } }, { projection: { id: 1, name: 1 }, limit: 100 }) : [];
  const proById = new Map(professionals.map((professional) => [professional.id, professional]));
  const accountById = new Map(accounts.map((account) => [account.id, account.name]));
  const sessions = records.length ? await store.findMany("sessions", { appointment_request_id: { $in: records.map((record) => record.id) } }, { limit: 100 }) : [];
  const [referrals, feedback] = await Promise.all([
    sessions.length ? store.findMany("referrals", { session_id: { $in: sessions.map((session) => session.id) } }, { limit: 100 }) : Promise.resolve([]),
    sessions.length ? store.findMany("feedback", { session_id: { $in: sessions.map((session) => session.id) } }, { limit: 100 }) : Promise.resolve([]),
  ]);
  const sessionByRequest = new Map(sessions.map((session) => [session.appointment_request_id, session]));
  const referralBySession = new Map(referrals.map((referral) => [referral.session_id, referral]));
  const feedbackBySession = new Map(feedback.map((entry) => [entry.session_id, entry]));
  return records.map((record) => { const professional = proById.get(record.professional_id), session = sessionByRequest.get(record.id) || null; return { ...record, ...requestFlowMeta(record), professional_name: professional ? accountById.get(professional.user_id) || "Profissional" : "Profissional", session, referral: session ? referralBySession.get(session.id) || null : null, feedback: session ? feedbackBySession.get(session.id) || null : null }; });
}

async function studentRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (!pathname.startsWith("/api/students/")) return undefined;
  const identity = await getStudent(request, env); if (isResponse(identity)) return identity;
  const { user, student } = identity, store = db(env);
  if (pathname === "/api/students/me" && request.method === "GET") return json({ student, name: user.name, institution: publicInstitution(await store.findOne("institutions", { id: student.institution_id })) });
  if (pathname === "/api/students/me/notifications" && request.method === "GET") return json(await listNotificationsPage(env, user.id, { before: new URL(request.url).searchParams.get("before") || undefined, includeUnreadCount: true }));
  if (pathname === "/api/students/me/notifications/read" && request.method === "POST") { const payload = await requestBody(request), ids = Array.isArray(payload?.ids) ? payload.ids.filter((value: unknown): value is string => typeof value === "string").slice(0, 100) : []; if (ids.length) await store.updateMany("notifications", { recipient_user_id: user.id, id: { $in: ids } }, { $set: { read: true, read_at: now() } }); return json({ ok: true }); }
  const studentNotificationId = pathParameter(pathname, "/api/students/me/notifications/", "/read");
  if (studentNotificationId && request.method === "POST") { await store.update("notifications", { id: studentNotificationId, recipient_user_id: user.id }, { $set: { read: true, read_at: now() } }); return json({ ok: true }); }
  if (pathname === "/api/students/me/dashboard" && request.method === "GET") {
    await expirePendingRequests(store, env, student.institution_id);
    const [professionals, requests, availabilityInterest, appointmentRequests] = await Promise.all([studentProfessionals(store, student), studentRequests(store, student), studentAvailabilityInterest(store, student), studentAppointmentRequests(store, student)]);
    await sessionReminderNotifications(store, env, requests.map((record) => record.session).filter((session): session is Doc => Boolean(session)), user.id);
    const notificationPage = await listNotificationsPage(env, user.id, { includeUnreadCount: true });
    return json({ professionals, requests, appointment_requests: appointmentRequests, availability_interest: availabilityInterest || null, notifications: notificationPage.items, notification_unread_count: notificationPage.unread_count || 0 });
  }
  if (pathname === "/api/students/me/professionals" && request.method === "GET") {
    return json(await studentProfessionals(store, student));
  }
  if (pathname === "/api/students/me/requests" && request.method === "POST") {
    const payload = await requestBody(request), availabilityId = string(payload?.availability_id), reason = payload?.reason_code, requestedMode = payload?.meeting_mode === undefined ? "online" : string(payload.meeting_mode);
    if (!availabilityId || !oneOf(reason, reasonCodes) || !oneOf(requestedMode, ["online", "presencial"]) || (payload?.reason_note !== undefined && string(payload.reason_note).length > 500)) return fail("Dados inválidos", 422);
    const slot = await store.findOne("availability", { id: availabilityId });
    if (!slot || slot.institution_id !== student.institution_id || !validDate(slot.date) || !validTime(slot.time) || String(slot.date) < localToday()) return fail("Horário não encontrado", 404);
    const slotMode = meetingModes.includes(slot.mode) ? slot.mode : "online";
    const professional = await store.findOne("professionals", { id: slot.professional_id }, { user_id: 1, link_type: 1 });
    if (requestedMode === "presencial" && slotMode === "online") return fail("Este horário não oferece atendimento presencial", 409);
    if (requestedMode === "presencial" && !slot.location) return fail("O local presencial ainda não foi configurado", 409);
    if (requestedMode === "presencial" && professional?.link_type !== "institution") return fail("Atendimento presencial disponível apenas com profissional da instituição", 409);
    if (requestedMode === "online" && slotMode === "presencial") return fail("Este horário é presencial", 409);
    if (await store.update("availability", { id: slot.id, status: "open" }, { $set: { status: "reserved" } }) === 0) return fail("Este horário acabou de ser reservado. Escolha outro.", 409);
    const record = { id: id(), student_id: student.id, professional_id: slot.professional_id, institution_id: student.institution_id, availability_id: slot.id, date: slot.date, time: slot.time, meeting_mode: requestedMode, meeting_location: requestedMode === "presencial" ? slot.location : null, reason_code: reason, reason_note: payload?.reason_note ? string(payload.reason_note) : null, status: "pending", created_at: now() };
    try { await store.insert("requests", record); } catch (error) { await store.update("availability", { id: slot.id, status: "reserved" }, { $set: { status: "open" } }); console.error("Request creation rolled back", error); return fail("Não foi possível criar a solicitação. Tente novamente.", 503); }
    if (professional?.user_id) await notifyUser(env, String(professional.user_id), "request_created", "Nova solicitação de conversa", `Há uma solicitação para ${record.date.split("-").reverse().join("/")} às ${record.time}.`, { request_id: record.id });
    await logEvent(env, "request_created", user, student.institution_id, { reason_code: reason }); return json(record, 201);
  }
  if (pathname === "/api/students/me/requests" && request.method === "GET") {
    return json(await studentRequests(store, student));
  }
  if (pathname === "/api/students/me/appointment-requests" && request.method === "POST") {
    const payload = await requestBody(request), professionalId = string(payload?.professional_id), reason = payload?.reason_code, requestedMode = payload?.meeting_mode === undefined ? "online" : string(payload.meeting_mode), note = payload?.note ? string(payload.note) : null;
    if (!professionalId || !oneOf(reason, reasonCodes) || !oneOf(requestedMode, ["online", "presencial"]) || (note !== null && note.length > 500)) return fail("Dados inválidos", 422);
    const professional = await store.findOne("professionals", { id: professionalId, institution_id: student.institution_id });
    if (!professional) return fail("Profissional não encontrado", 404);
    if (requestedMode === "presencial" && professional.link_type !== "institution") return fail("Atendimento presencial disponível apenas com profissional da instituição", 409);
    const activeRequest = await store.findOne("requests", { student_id: student.id, status: { $in: ["pending", "accepted"] } });
    const activeAppointment = await store.findOne("appointment_requests", { student_id: student.id, status: { $in: ["pending", "proposed"] } });
    if (activeRequest || activeAppointment) return fail("Você já tem um atendimento em andamento", 409);
    const record = { id: id(), student_id: student.id, professional_id: professionalId, institution_id: student.institution_id, reason_code: reason, meeting_mode: requestedMode, note, status: "pending", created_at: now() };
    await store.insert("appointment_requests", record);
    if (professional.user_id) await notifyUser(env, String(professional.user_id), "appointment_request_created", "Pedido direto de atendimento", "Um estudante pediu que você proponha uma data e horário para conversar.", { appointment_request_id: record.id });
    await refreshPanels(env, store, student.institution_id, "institution");
    await refreshPanels(env, store, student.institution_id, "admin");
    await logEvent(env, "appointment_request_created", user, student.institution_id, { appointment_request_id: record.id, professional_id: professionalId });
    return json(record, 201);
  }
  const appointmentCancelId = pathParameter(pathname, "/api/students/me/appointment-requests/", "/cancel");
  if (appointmentCancelId && request.method === "POST") {
    const record = await store.findOne("appointment_requests", { id: appointmentCancelId, student_id: student.id, status: { $in: ["pending", "proposed"] } });
    if (!record) return fail("Pedido de atendimento não encontrado", 404);
    await store.update("appointment_requests", { id: appointmentCancelId, student_id: student.id, status: { $in: ["pending", "proposed"] } }, { $set: { status: "cancelled", cancelled_at: now() } });
    if (record.availability_id) await store.update("availability", { id: record.availability_id, status: "reserved" }, { $set: { status: "open" } });
    const professional = await store.findOne("professionals", { id: record.professional_id }, { user_id: 1 });
    if (professional?.user_id) await notifyUser(env, String(professional.user_id), "appointment_request_cancelled", "Pedido cancelado", "O estudante cancelou o pedido de atendimento.", { appointment_request_id: appointmentCancelId });
    await refreshPanels(env, store, student.institution_id, "institution");
    await refreshPanels(env, store, student.institution_id, "admin");
    return json({ ok: true });
  }
  const appointmentConfirmId = pathParameter(pathname, "/api/students/me/appointment-requests/", "/confirm");
  if (appointmentConfirmId && request.method === "POST") {
    const record = await store.findOne("appointment_requests", { id: appointmentConfirmId, student_id: student.id, status: "proposed" });
    if (!record || !record.date || !record.time) return fail("Não há uma proposta para confirmar", 409);
    const today = localToday(), currentTime = localCurrentTime();
    if (!validDate(record.date) || !validTime(record.time) || record.date < today || (record.date === today && record.time <= currentTime)) return fail("Este horário já passou. Solicite uma nova proposta.", 409);
    if (await store.update("appointment_requests", { id: appointmentConfirmId, student_id: student.id, status: "proposed" }, { $set: { status: "accepted", confirmed_at: now() } }) === 0) return fail("Esta proposta já foi alterada", 409);
    // Keep a unique legacy request key while older Atlas indexes are still in
    // place. Appointment sessions use appointment_request_id as their source;
    // this compatibility value prevents the old request_id unique index from
    // treating every appointment session as the same null value.
    const session = { id: id(), request_id: `appointment:${appointmentConfirmId}`, appointment_request_id: appointmentConfirmId, student_id: student.id, professional_id: record.professional_id, institution_id: student.institution_id, date: record.date, time: record.time, meeting_mode: record.meeting_mode, status: "scheduled", created_at: now() };
    try { await store.insert("sessions", session); } catch (error) {
      await store.update("appointment_requests", { id: appointmentConfirmId, student_id: student.id, status: "accepted" }, { $set: { status: "proposed" }, $unset: { confirmed_at: true } });
      console.error("Appointment confirmation rolled back", error);
      return fail("Não foi possível confirmar o horário. Tente novamente.", 503);
    }
    const professional = await store.findOne("professionals", { id: record.professional_id }, { user_id: 1 });
    if (professional?.user_id) await notifyUser(env, String(professional.user_id), "appointment_request_confirmed", "Horário confirmado", `O estudante confirmou ${record.date.split("-").reverse().join("/")} às ${record.time}.`, { appointment_request_id: appointmentConfirmId, session_id: session.id });
    await refreshProfessionalPanel(env, store, record.professional_id);
    await refreshPanels(env, store, student.institution_id, "institution");
    await refreshPanels(env, store, student.institution_id, "admin");
    return json(session, 201);
  }
  if (pathname === "/api/students/me/availability-interest" && request.method === "POST") {
    return fail("O pedido anônimo foi descontinuado. Escolha um profissional para pedir atendimento.", 410);
  }
  const cancelAvailabilityInterestId = pathParameter(pathname, "/api/students/me/availability-interest/", "/cancel");
  if (cancelAvailabilityInterestId && request.method === "POST") {
    if (await store.update("availability_interests", { id: cancelAvailabilityInterestId, student_id: student.id, status: "waiting" }, { $set: { status: "cancelled", cancelled_at: now() } }) === 0) return fail("Este pedido não está mais aguardando horário.", 409);
    await refreshPanels(env, store, student.institution_id, "institution");
    await refreshPanels(env, store, student.institution_id, "admin");
    await logEvent(env, "availability_interest_cancelled", user, student.institution_id, { interest_id: cancelAvailabilityInterestId });
    return json({ ok: true });
  }
  const cancelId = pathParameter(pathname, "/api/students/me/requests/", "/cancel");
  if (cancelId && request.method === "POST") { const record = await store.findOne("requests", { id: cancelId, student_id: student.id }); if (!record) return fail("Solicitação não encontrada", 404); if (!(record.status === "pending" || record.status === "accepted")) return fail("Esta solicitação não pode mais ser cancelada", 409); if (await store.update("requests", { id: cancelId, student_id: student.id, status: { $in: ["pending", "accepted"] } }, { $set: { status: "cancelled" } }) === 0) return fail("Esta solicitação não pode mais ser cancelada", 409); await store.update("availability", { id: record.availability_id, status: "reserved" }, { $set: { status: "open" } }); await store.remove("sessions", { request_id: cancelId, status: "scheduled" }, true); const professional = await store.findOne("professionals", { id: record.professional_id }, { user_id: 1 }); if (professional?.user_id) await notifyUser(env, String(professional.user_id), "request_cancelled", "Conversa cancelada pelo estudante", `O horário de ${record.date.split("-").reverse().join("/")} às ${record.time} voltou a ficar disponível.`, { request_id: cancelId }); await refreshPanels(env, store, student.institution_id, "institution"); await refreshPanels(env, store, student.institution_id, "admin"); await logEvent(env, "request_cancelled", user, student.institution_id, { request_id: cancelId }); return json({ ok: true }); }
  const rescheduleId = pathParameter(pathname, "/api/students/me/requests/", "/reschedule");
  if (rescheduleId && request.method === "POST") {
    const payload = await requestBody(request), newAvailabilityId = string(payload?.availability_id);
    const record = await store.findOne("requests", { id: rescheduleId, student_id: student.id });
    if (!record || !["pending", "accepted"].includes(record.status)) return fail("Esta solicitação não pode ser remarcada", 409);
    const requestedMode = payload?.meeting_mode === undefined ? record.meeting_mode || "online" : string(payload.meeting_mode);
    if (!oneOf(requestedMode, ["online", "presencial"])) return fail("Modalidade inválida", 422);
    const slot = await store.findOne("availability", { id: newAvailabilityId });
    if (!slot || slot.institution_id !== student.institution_id || slot.id === record.availability_id || slot.status !== "open" || !validDate(slot.date) || !validTime(slot.time)) return fail("Escolha outro horário disponível", 409);
    const slotMode = meetingModes.includes(slot.mode) ? slot.mode : "online";
    const newProfessional = await store.findOne("professionals", { id: slot.professional_id }, { link_type: 1, user_id: 1 });
    if (requestedMode === "presencial" && (slotMode === "online" || !slot.location || newProfessional?.link_type !== "institution")) return fail("Este horário não oferece atendimento presencial", 409);
    if (requestedMode === "online" && slotMode === "presencial") return fail("Este horário é presencial", 409);
    if (await store.update("availability", { id: slot.id, status: "open" }, { $set: { status: "reserved" } }) === 0) return fail("Este horário acabou de ser reservado. Escolha outro.", 409);
    const updated = await store.update("requests", { id: rescheduleId, student_id: student.id, status: { $in: ["pending", "accepted"] } }, { $set: { availability_id: slot.id, professional_id: slot.professional_id, date: slot.date, time: slot.time, meeting_mode: requestedMode, meeting_location: requestedMode === "presencial" ? slot.location : null, status: "pending", rescheduled_at: now() } });
    if (!updated) { await store.update("availability", { id: slot.id, status: "reserved" }, { $set: { status: "open" } }); return fail("Esta solicitação já foi alterada", 409); }
    await store.remove("sessions", { request_id: rescheduleId, status: "scheduled" }, true);
    await store.update("availability", { id: record.availability_id, status: "reserved" }, { $set: { status: "open" } });
    const professional = await store.findOne("professionals", { id: slot.professional_id }, { user_id: 1 });
    if (professional?.user_id) await notifyUser(env, String(professional.user_id), "request_rescheduled", "Solicitação remarcada", `Há uma nova solicitação para ${slot.date.split("-").reverse().join("/")} às ${slot.time}.`, { request_id: rescheduleId });
    await refreshPanels(env, store, student.institution_id, "institution");
    await refreshPanels(env, store, student.institution_id, "admin");
    await logEvent(env, "request_rescheduled", user, student.institution_id, { request_id: rescheduleId });
    return json({ ok: true, date: slot.date, time: slot.time });
  }
  const feedbackId = pathParameter(pathname, "/api/students/me/sessions/", "/feedback");
  const studentChatId = pathParameter(pathname, "/api/students/me/sessions/", "/messages");
  if (studentChatId && request.method === "GET") { const session = await store.findOne("sessions", { id: studentChatId, student_id: student.id }); if (!session) return fail("Conversa não encontrada", 404); return json(await store.findMany("session_messages", { session_id: studentChatId }, { sort: { created_at: 1 }, limit: 200 })); }
  if (studentChatId && request.method === "POST") { const payload = await requestBody(request), body = string(payload?.body).trim(); const session = await store.findOne("sessions", { id: studentChatId, student_id: student.id }); if (!session) return fail("Conversa não encontrada", 404); if (session.status !== "scheduled") return fail("O chat foi encerrado após a conversa", 409); if (body.length < 1 || body.length > 1000) return fail("Escreva uma mensagem de 1 a 1000 caracteres", 422); const record = { id: id(), session_id: studentChatId, sender_user_id: user.id, sender_role: "student", body, created_at: now() }; await store.insert("session_messages", record); await broadcastRealtime(env, { sessionId: studentChatId, event: { type: "message", message: record } }); const professional = await store.findOne("professionals", { id: session.professional_id }, { user_id: 1 }); if (professional?.user_id) await notifyUser(env, String(professional.user_id), "chat_message_received", "Nova mensagem sobre sua conversa", "O estudante enviou uma mensagem antes do encontro.", { session_id: studentChatId }); return json(record, 201); }
  if (feedbackId && request.method === "POST") { const payload = await requestBody(request), score = Number(payload?.score); if (!Number.isInteger(score) || score < 1 || score > 5 || (payload?.comment !== undefined && string(payload.comment).length > 400)) return fail("Dados inválidos", 422); const session = await store.findOne("sessions", { id: feedbackId, student_id: student.id }); if (!session) return fail("Conversa não encontrada", 404); if (session.status !== "completed") return fail("Feedback disponível após a conversa", 409); const record = { id: id(), session_id: feedbackId, student_id: student.id, institution_id: student.institution_id, score, comment: payload?.comment ? string(payload.comment) : null, created_at: now() }; await store.update("feedback", { session_id: feedbackId }, { $set: record }, true); await notifyInstitutionManagers(env, store, student.institution_id, "feedback_received", "Novo feedback recebido", "Um novo feedback foi recebido e os indicadores agregados do piloto foram atualizados.", { score }); await notifyAdmins(env, store, "feedback_received", "Novo feedback agregado", "Um novo feedback foi registrado e os indicadores agregados do piloto foram atualizados.", { institution_id: student.institution_id, score }); await logEvent(env, "feedback_submitted", user, student.institution_id, { score }); return json(record, 201); }
  return undefined;
}

async function professionalRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (!pathname.startsWith("/api/professionals/")) return undefined;
  const identity = await getProfessional(request, env); if (isResponse(identity)) return identity;
  const { user, professional } = identity, store = db(env);
  if (pathname === "/api/professionals/me" && request.method === "GET") return json({ professional, name: user.name, institution: publicInstitution(await store.findOne("institutions", { id: professional.institution_id })) });
  if (pathname === "/api/professionals/me/notifications" && request.method === "GET") return json(await listNotificationsPage(env, user.id, { before: new URL(request.url).searchParams.get("before") || undefined, includeUnreadCount: true }));
  if (pathname === "/api/professionals/me/notifications/read" && request.method === "POST") { const payload = await requestBody(request), ids = Array.isArray(payload?.ids) ? payload.ids.filter((value: unknown): value is string => typeof value === "string").slice(0, 100) : []; if (ids.length) await store.updateMany("notifications", { recipient_user_id: user.id, id: { $in: ids } }, { $set: { read: true, read_at: now() } }); return json({ ok: true }); }
  if (pathname === "/api/professionals/me/certificate" && request.method === "GET") {
    const completedCount = (await store.findMany("sessions", { professional_id: professional.id, status: "completed" }, { projection: { id: 1 }, limit: 500 })).length;
    const certificate = (await store.findMany("certificates", { professional_id: professional.id, status: "valid" }, { sort: { issued_at: -1 }, limit: 1 }))[0] || null;
    return json({ eligible: completedCount >= 5, completed_count: completedCount, required_count: 5, certificate: certificate || null });
  }
  if (pathname === "/api/professionals/me/certificate" && request.method === "POST") {
    const completedCount = (await store.findMany("sessions", { professional_id: professional.id, status: "completed" }, { projection: { id: 1 }, limit: 500 })).length;
    if (completedCount < 5) return fail("Complete pelo menos 5 conversas para emitir o certificado.", 409);
    const existing = (await store.findMany("certificates", { professional_id: professional.id, status: "valid" }, { sort: { issued_at: -1 }, limit: 1 }))[0] || null;
    if (existing) return json({ certificate: existing });
    const institution = await store.findOne("institutions", { id: professional.institution_id }, { name: 1 });
    const certificate = { id: id(), code: `AC-${localScheduleParts().year}-${crypto.randomUUID().split("-")[0].toUpperCase()}`, title: "Certificado de participação no piloto Acolhe", professional_id: professional.id, professional_name: user.name, institution_name: institution?.name || "Piloto Acolhe", completed_count: completedCount, issued_at: now(), status: "valid" };
    await store.insert("certificates", certificate);
    return json({ certificate }, 201);
  }
  const professionalNotificationId = pathParameter(pathname, "/api/professionals/me/notifications/", "/read");
  if (professionalNotificationId && request.method === "POST") { await store.update("notifications", { id: professionalNotificationId, recipient_user_id: user.id }, { $set: { read: true, read_at: now() } }); return json({ ok: true }); }
  if (pathname === "/api/professionals/me/dashboard" && request.method === "GET") {
    await expirePendingRequests(store, env, professional.institution_id);
    const [availability, requests, sessions, availabilityInterests, appointmentRequests] = await Promise.all([
      store.findMany("availability", { professional_id: professional.id, date: { $gte: localToday() } }, { sort: sortDate, limit: 500 }),
      store.findMany("requests", { professional_id: professional.id }, { sort: sortDate, limit: 500 }),
      store.findMany("sessions", { professional_id: professional.id }, { sort: sortDate, limit: 500 }),
      store.findMany("availability_interests", { institution_id: professional.institution_id, status: "waiting" }, { projection: { reason_code: 1 }, limit: 500 }),
      store.findMany("appointment_requests", { professional_id: professional.id, status: { $in: ["pending", "proposed"] } }, { sort: { created_at: -1 }, limit: 100 }),
    ]);
    const appointmentStudentIds = appointmentRequests.map((record) => record.student_id);
    const appointmentStudents = appointmentStudentIds.length ? await store.findMany("students", { id: { $in: appointmentStudentIds } }, { projection: { id: 1, user_id: 1 }, limit: 100 }) : [];
    const appointmentStudentUsers = appointmentStudents.length ? await store.findMany("users", { id: { $in: appointmentStudents.map((student) => student.user_id) } }, { projection: { id: 1, name: 1 }, limit: 100 }) : [];
    const studentUserById = new Map(appointmentStudentUsers.map((account) => [account.id, account.name]));
    const studentById = new Map(appointmentStudents.map((student) => [student.id, student]));
    const requestIds = requests.map((record) => record.id), sessionRequestIds = sessions.map((session) => session.request_id);
    const [requestSessions, sessionRequests, referrals] = await Promise.all([
      requestIds.length ? store.findMany("sessions", { request_id: { $in: requestIds } }, { limit: 500 }) : Promise.resolve([]),
      sessionRequestIds.length ? store.findMany("requests", { id: { $in: sessionRequestIds } }, { limit: 500 }) : Promise.resolve([]),
      sessions.length ? store.findMany("referrals", { session_id: { $in: sessions.map((session) => session.id) } }, { limit: 500 }) : Promise.resolve([]),
    ]);
    const requestSessionById = new Map(requestSessions.map((session) => [session.request_id, session]));
    const requestById = new Map(sessionRequests.map((record) => [record.id, record]));
    const referralBySession = new Map(referrals.map((referral) => [referral.session_id, referral]));
    const sessionStudentIds = [...new Set(sessions.map((session) => session.student_id).filter(Boolean))];
    const sessionStudents = sessionStudentIds.length ? await store.findMany("students", { id: { $in: sessionStudentIds } }, { projection: { id: 1, user_id: 1 }, limit: 500 }) : [];
    const sessionStudentUsers = sessionStudents.length ? await store.findMany("users", { id: { $in: sessionStudents.map((student) => student.user_id) } }, { projection: { id: 1, name: 1 }, limit: 500 }) : [];
    const sessionUserNameById = new Map(sessionStudentUsers.map((account) => [account.id, account.name]));
    const sessionStudentNameById = new Map(sessionStudents.map((student) => [student.id, sessionUserNameById.get(student.user_id) || "Estudante"]));
    await sessionReminderNotifications(store, env, sessions, user.id);
    const availabilityInterestByReason = availabilityInterests.reduce<Record<string, number>>((counts, interest) => { counts[String(interest.reason_code)] = (counts[String(interest.reason_code)] || 0) + 1; return counts; }, {});
    const notificationPage = await listNotificationsPage(env, user.id, { includeUnreadCount: true });
    return json({ availability, availability_interest: { total: availabilityInterests.length, by_reason: availabilityInterestByReason }, notifications: notificationPage.items, notification_unread_count: notificationPage.unread_count || 0, appointment_requests: appointmentRequests.map((record) => { const student = studentById.get(record.student_id); return { ...record, ...requestFlowMeta(record), student_name: student ? studentUserById.get(student.user_id) || "Estudante" : "Estudante" }; }), requests: requests.map((record) => ({ ...requestFlowMeta(record), id: record.id, date: record.date, time: record.time, status: record.status, meeting_mode: record.meeting_mode || "online", meeting_location: record.meeting_location || null, reason_code: record.reason_code, reason_note: record.reason_note, room_link: record.room_link, created_at: record.created_at, session: requestSessionById.get(record.id) || null })), sessions: sessions.map((session) => { const record = requestById.get(session.request_id); return { ...session, student_name: sessionStudentNameById.get(session.student_id) || "Estudante", meeting_mode: record?.meeting_mode || session.meeting_mode || "online", meeting_location: record?.meeting_location || null, reason_code: record?.reason_code, reason_note: record?.reason_note, room_link: record?.room_link || session.room_link || null, referral: referralBySession.get(session.id) || null }; }) });
  }
  if (pathname === "/api/professionals/me/availability" && request.method === "GET") return json(await store.findMany("availability", { professional_id: professional.id, date: { $gte: localToday() } }, { sort: sortDate, limit: 500 }));
  if (pathname === "/api/professionals/me/availability" && request.method === "POST") {
    const payload = await requestBody(request);
    const meetingMode = payload?.meeting_mode === undefined ? "online" : string(payload.meeting_mode);
    const location = meetingMode === "online" ? null : "Na instituição";
    if (!oneOf(meetingMode, meetingModes)) return fail("Modalidade inválida", 422);
    if (meetingMode !== "online" && professional.link_type !== "institution") return fail("Atendimento presencial disponível apenas para profissional da instituição", 403);
    if (payload?.mode === "recurring") {
      const startDate = string(payload.start_date), startTime = string(payload.start_time), endTime = string(payload.end_time);
      const weekdays = Array.isArray(payload.weekdays) ? [...new Set(payload.weekdays)] : [];
      const duration = Number(payload.slot_minutes), weeks = Number(payload.weeks);
      const validWeekdays = weekdays.length > 0 && weekdays.length <= 7 && weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
      const weeklySlots = validTime(startTime) && validTime(endTime) && duration > 0 && timeToMinutes(endTime) > timeToMinutes(startTime)
        ? Math.floor((timeToMinutes(endTime) - timeToMinutes(startTime)) / duration) * weekdays.length : 0;
      const weeklyMinutes = weeklySlots * duration;
      if (!validDate(startDate) || !validWeekdays || !validTime(startTime) || !validTime(endTime) || ![15, 20, 30, 45, 60].includes(duration) || !Number.isInteger(weeks) || weeks < 1 || weeks > 8 || timeToMinutes(endTime) <= timeToMinutes(startTime) || weeklyMinutes < 120 || weeklySlots > 40) {
        return fail("Defina dias, uma janela válida e pelo menos 2 horas por semana.", 422);
      }
      const generated = recurringAvailability(startDate, weekdays as number[], startTime, endTime, duration, weeks);
      const today = localToday(), currentTime = localCurrentTime();
      if (!generated.length || generated.length > 200 || generated.some((slot) => slot.date < today || (slot.date === today && slot.time <= currentTime))) return fail("A disponibilidade precisa começar no futuro.", 422);
      const existing = await store.findMany("availability", { professional_id: professional.id, date: { $in: [...new Set(generated.map((slot) => slot.date))] }, time: { $in: [...new Set(generated.map((slot) => slot.time))] } }, { projection: { date: 1, time: 1 }, limit: 500 });
      const existingKeys = new Set(existing.map((slot) => `${slot.date}|${slot.time}`));
      if (generated.some((slot) => existingKeys.has(`${slot.date}|${slot.time}`))) return fail("Já existe disponibilidade publicada em parte desse período.", 409);
      const created: Doc[] = [];
      try {
        for (const slotData of generated) {
          const slot = { id: id(), professional_id: professional.id, institution_id: professional.institution_id, date: slotData.date, time: slotData.time, mode: meetingMode, location, status: "open", created_at: now() };
          await store.insert("availability", slot); created.push(slot);
        }
      } catch (error) {
        if (created.length) await store.remove("availability", { id: { $in: created.map((slot) => slot.id) } }, true);
        console.error("Recurring availability creation rolled back", error);
        return fail("Não foi possível publicar toda a disponibilidade. Tente novamente.", 409);
      }
      await logEvent(env, "availability_created", user, professional.institution_id, { count: created.length, recurring: true, weekdays, startDate, startTime, endTime, duration, weeks });
      await notifyWaitingStudents(env, store, professional.institution_id, created.length);
      await refreshStudentPanels(env, store, professional.institution_id);
      return json(created, 201);
    }
    const date = payload?.date, times = payload?.times;
    const uniqueTimes = Array.isArray(times) ? new Set(times) : new Set();
    const today = localToday(), currentTime = localCurrentTime();
    if (!validDate(date) || !Array.isArray(times) || times.length < 1 || times.length > 20 || uniqueTimes.size !== times.length || times.some((time) => !validTime(time) || (date === today && time <= currentTime))) return fail("Dados inválidos", 422);
    const created: Doc[] = [];
    try { for (const time of times) { const slot = { id: id(), professional_id: professional.id, institution_id: professional.institution_id, date, time: time.trim(), mode: meetingMode, location, status: "open", created_at: now() }; await store.insert("availability", slot); created.push(slot); } } catch (error) { if (created.length) await store.remove("availability", { id: { $in: created.map((slot) => slot.id) } }, true); console.error("Availability creation rolled back", error); return fail("Não foi possível publicar todos os horários. Verifique duplicidades e tente novamente.", 409); }
    await logEvent(env, "availability_created", user, professional.institution_id, { count: created.length }); await notifyWaitingStudents(env, store, professional.institution_id, created.length); await refreshStudentPanels(env, store, professional.institution_id); return json(created, 201);
  }
  const slotId = pathParameter(pathname, "/api/professionals/me/availability/");
  if (slotId && request.method === "DELETE") { const slot = await store.findOne("availability", { id: slotId, professional_id: professional.id }); if (!slot) return fail("Horário não encontrado", 404); if (slot.status === "reserved") return fail("Horário reservado por um estudante", 409); await store.remove("availability", { id: slotId }); await refreshStudentPanels(env, store, professional.institution_id); return json({ ok: true }); }
  if (pathname === "/api/professionals/me/requests" && request.method === "GET") { const requests = await store.findMany("requests", { professional_id: professional.id }, { sort: sortDate, limit: 500 }); const sessions = requests.length ? await store.findMany("sessions", { request_id: { $in: requests.map((record) => record.id) } }, { limit: 500 }) : []; const sessionByRequest = new Map(sessions.map((session) => [session.request_id, session])); return json(requests.map((record) => ({ id: record.id, date: record.date, time: record.time, status: record.status, meeting_mode: record.meeting_mode || "online", meeting_location: record.meeting_location || null, reason_code: record.reason_code, reason_note: record.reason_note, room_link: record.room_link, created_at: record.created_at, session: sessionByRequest.get(record.id) || null }))); }
  const appointmentProposeId = pathParameter(pathname, "/api/professionals/me/appointment-requests/", "/propose");
  if (appointmentProposeId && request.method === "POST") {
    const payload = await requestBody(request), availabilityId = string(payload?.availability_id), proposedDate = string(payload?.date), proposedTime = string(payload?.time);
    const record = await store.findOne("appointment_requests", { id: appointmentProposeId, professional_id: professional.id, status: "pending" });
    if (!record) return fail("Pedido de atendimento não encontrado", 404);
    const today = localToday(), currentTime = localCurrentTime();
    let slot = null;
    if (availabilityId) {
      slot = await store.findOne("availability", { id: availabilityId, professional_id: professional.id, institution_id: professional.institution_id });
      if (!slot) return fail("Horário não encontrado. Atualize sua agenda e tente novamente.", 409);
      if (slot.status !== "open") return fail("Este horário acabou de ser reservado. Atualize sua agenda e escolha outro.", 409);
      if (!validDate(slot.date) || !validTime(slot.time) || slot.date < today || (slot.date === today && slot.time <= currentTime)) return fail("Este horário já passou. Escolha uma nova disponibilidade.", 409);
      if (record.meeting_mode === "presencial" && slot.mode === "online") return fail("O pedido exige um horário presencial", 409);
      if (await store.update("availability", { id: slot.id, professional_id: professional.id, status: "open" }, { $set: { status: "reserved" } }) === 0) return fail("Este horário acabou de ser reservado", 409);
    } else {
      if (!validDate(proposedDate) || !validTime(proposedTime) || proposedDate < today || (proposedDate === today && proposedTime <= currentTime)) return fail("Escolha uma data e hora futuras.", 422);
      // A direct proposal still becomes a real capacity record, so utilization
      // metrics and conflict checks remain aligned with scheduled meetings.
      const generatedSlot = { id: id(), professional_id: professional.id, institution_id: professional.institution_id, date: proposedDate, time: proposedTime, mode: record.meeting_mode === "presencial" ? "presencial" : "online", location: null, status: "reserved", source: "direct_request", created_at: now() };
      try { await store.insert("availability", generatedSlot); slot = generatedSlot; } catch { return fail("Este horário acabou de ser reservado. Escolha outra data ou hora.", 409); }
    }
    const date = slot?.date || proposedDate;
    const time = slot?.time || proposedTime;
    const [scheduledConflict, proposedConflict] = await Promise.all([
      store.findOne("sessions", { professional_id: professional.id, status: "scheduled", date, time }),
      store.findOne("appointment_requests", { professional_id: professional.id, status: "proposed", date, time }),
    ]);
    if (scheduledConflict || proposedConflict) {
      if (slot) await store.update("availability", { id: slot.id, status: "reserved" }, { $set: { status: "open" } });
      return fail("Este horário já está ocupado. Escolha outra data ou horário.", 409);
    }
    const updated = await store.update("appointment_requests", { id: appointmentProposeId, professional_id: professional.id, status: "pending" }, { $set: { status: "proposed", availability_id: slot?.id || null, date, time, meeting_location: slot?.location || null, proposed_at: now(), responded_at: now() } });
    if (!updated) { if (slot) await store.update("availability", { id: slot.id, status: "reserved" }, { $set: { status: "open" } }); return fail("Este pedido já foi alterado", 409); }
    const student = await store.findOne("students", { id: record.student_id }, { user_id: 1 });
    if (student?.user_id) await notifyUser(env, String(student.user_id), "appointment_request_proposed", "Novo horário proposto", `O profissional sugeriu ${date.split("-").reverse().join("/")} às ${time}.`, { appointment_request_id: appointmentProposeId });
    await refreshPanels(env, store, professional.institution_id, "institution");
    await refreshPanels(env, store, professional.institution_id, "admin");
    return json({ ok: true, date, time });
  }
  const appointmentDeclineId = pathParameter(pathname, "/api/professionals/me/appointment-requests/", "/decline");
  if (appointmentDeclineId && request.method === "POST") {
    const record = await store.findOne("appointment_requests", { id: appointmentDeclineId, professional_id: professional.id, status: { $in: ["pending", "proposed"] } });
    if (!record) return fail("Pedido de atendimento não encontrado", 404);
    await store.update("appointment_requests", { id: appointmentDeclineId, professional_id: professional.id, status: { $in: ["pending", "proposed"] } }, { $set: { status: "declined", declined_at: now(), responded_at: now() } });
    if (record.availability_id) await store.update("availability", { id: record.availability_id, status: "reserved" }, { $set: { status: "open" } });
    const student = await store.findOne("students", { id: record.student_id }, { user_id: 1 });
    if (student?.user_id) await notifyUser(env, String(student.user_id), "appointment_request_declined", "Pedido não confirmado", "O profissional não conseguiu propor um horário agora.", { appointment_request_id: appointmentDeclineId });
    await refreshPanels(env, store, professional.institution_id, "institution");
    await refreshPanels(env, store, professional.institution_id, "admin");
    return json({ ok: true });
  }
  const acceptId = pathParameter(pathname, "/api/professionals/me/requests/", "/accept");
  if (acceptId && request.method === "POST") { const record = await store.findOne("requests", { id: acceptId, professional_id: professional.id }); if (!record) return fail("Solicitação não encontrada", 404); if (await store.update("requests", { id: acceptId, professional_id: professional.id, status: "pending" }, { $set: { status: "accepted", responded_at: now() } }) === 0) return fail("Solicitação já tratada", 409); const session = { id: id(), request_id: acceptId, student_id: record.student_id, professional_id: professional.id, institution_id: professional.institution_id, date: record.date, time: record.time, status: "scheduled", created_at: now() }; try { await store.insert("sessions", session); } catch (error) { await store.update("requests", { id: acceptId, status: "accepted" }, { $set: { status: "pending" } }); console.error("Request acceptance rolled back", error); return fail("Não foi possível confirmar a conversa. Tente novamente.", 503); } const student = await store.findOne("students", { id: record.student_id }, { user_id: 1 }); if (student?.user_id) await notifyUser(env, String(student.user_id), "request_accepted", "Conversa confirmada", `Sua conversa foi confirmada para ${record.date.split("-").reverse().join("/")} às ${record.time}.`, { request_id: acceptId, session_id: session.id }); await refreshStudentPanels(env, store, professional.institution_id); await refreshPanels(env, store, professional.institution_id, "institution"); await refreshPanels(env, store, professional.institution_id, "admin"); await logEvent(env, "request_accepted", user, professional.institution_id, { request_id: acceptId }); return json(session); }
  const declineId = pathParameter(pathname, "/api/professionals/me/requests/", "/decline");
  if (declineId && request.method === "POST") { const record = await store.findOne("requests", { id: declineId, professional_id: professional.id }); if (!record) return fail("Solicitação não encontrada", 404); if (await store.update("requests", { id: declineId, professional_id: professional.id, status: "pending" }, { $set: { status: "declined", responded_at: now() } }) === 0) return fail("Solicitação já tratada", 409); await store.update("availability", { id: record.availability_id }, { $set: { status: "open" } }); const student = await store.findOne("students", { id: record.student_id }, { user_id: 1 }); if (student?.user_id) await notifyUser(env, String(student.user_id), "request_declined", "Solicitação não confirmada", "O profissional não conseguiu confirmar este horário. Você pode escolher outro quando houver disponibilidade.", { request_id: declineId }); await refreshPanels(env, store, professional.institution_id, "institution"); await refreshPanels(env, store, professional.institution_id, "admin"); await logEvent(env, "request_declined", user, professional.institution_id, { request_id: declineId }); return json({ ok: true }); }
  const roomId = pathParameter(pathname, "/api/professionals/me/requests/", "/room-link");
  if (roomId && request.method === "POST") { const payload = await requestBody(request), roomLink = string(payload?.room_link); let parsedLink: URL; try { parsedLink = new URL(roomLink); } catch { return fail("Informe um link HTTPS válido", 422); } if (roomLink.length < 8 || roomLink.length > 300 || parsedLink.protocol !== "https:" || !parsedLink.hostname) return fail("Informe um link HTTPS válido", 422); const record = await store.findOne("requests", { id: roomId, professional_id: professional.id }); if (!record) return fail("Solicitação não encontrada", 404); if (record.status !== "accepted") return fail("Só é possível definir a sala de uma conversa confirmada", 409); const session = await store.findOne("sessions", { request_id: roomId }); if (session?.status === "completed" || session?.status === "no_show") return fail("Conversa já encerrada", 409); await store.update("requests", { id: roomId }, { $set: { room_link: roomLink } }); const student = await store.findOne("students", { id: record.student_id }, { user_id: 1 }); if (student?.user_id) await notifyUser(env, String(student.user_id), "room_link_added", "Link da conversa disponível", "O profissional adicionou o link da sala para sua conversa.", { request_id: roomId, session_id: session?.id }); await refreshPanels(env, store, professional.institution_id, "institution"); await refreshPanels(env, store, professional.institution_id, "admin"); return json({ ok: true, room_link: roomLink }); }
  const sessionRoomId = pathParameter(pathname, "/api/professionals/me/sessions/", "/room-link");
  if (sessionRoomId && request.method === "POST") { const payload = await requestBody(request), roomLink = string(payload?.room_link); let parsedLink: URL; try { parsedLink = new URL(roomLink); } catch { return fail("Informe um link HTTPS válido", 422); } if (roomLink.length < 8 || roomLink.length > 300 || parsedLink.protocol !== "https:" || !parsedLink.hostname) return fail("Informe um link HTTPS válido", 422); const session = await store.findOne("sessions", { id: sessionRoomId, professional_id: professional.id }); if (!session) return fail("Conversa não encontrada", 404); if (session.status !== "scheduled") return fail("Só é possível definir a sala de uma conversa agendada", 409); await store.update("sessions", { id: sessionRoomId, professional_id: professional.id }, { $set: { room_link: roomLink } }); if (session.request_id) await store.update("requests", { id: session.request_id, professional_id: professional.id }, { $set: { room_link: roomLink } }); const student = await store.findOne("students", { id: session.student_id }, { user_id: 1 }); if (student?.user_id) await notifyUser(env, String(student.user_id), "room_link_added", "Link da conversa disponível", "O profissional adicionou o link da sala para sua conversa.", { session_id: sessionRoomId }); await refreshPanels(env, store, professional.institution_id, "institution"); await refreshPanels(env, store, professional.institution_id, "admin"); return json({ ok: true, room_link: roomLink }); }
  const professionalChatId = pathParameter(pathname, "/api/professionals/me/sessions/", "/messages");
  if (professionalChatId && request.method === "GET") { const session = await store.findOne("sessions", { id: professionalChatId, professional_id: professional.id }); if (!session) return fail("Conversa não encontrada", 404); return json(await store.findMany("session_messages", { session_id: professionalChatId }, { sort: { created_at: 1 }, limit: 200 })); }
  if (professionalChatId && request.method === "POST") { const payload = await requestBody(request), body = string(payload?.body).trim(); const session = await store.findOne("sessions", { id: professionalChatId, professional_id: professional.id }); if (!session) return fail("Conversa não encontrada", 404); if (session.status !== "scheduled") return fail("O chat foi encerrado após a conversa", 409); if (body.length < 1 || body.length > 1000) return fail("Escreva uma mensagem de 1 a 1000 caracteres", 422); const record = { id: id(), session_id: professionalChatId, sender_user_id: user.id, sender_role: "professional", body, created_at: now() }; await store.insert("session_messages", record); await broadcastRealtime(env, { sessionId: professionalChatId, event: { type: "message", message: record } }); const student = await store.findOne("students", { id: session.student_id }, { user_id: 1 }); if (student?.user_id) await notifyUser(env, String(student.user_id), "chat_message_received", "Nova mensagem do profissional", "Você recebeu uma mensagem sobre sua conversa.", { session_id: professionalChatId }); return json(record, 201); }
  if (pathname === "/api/professionals/me/sessions" && request.method === "GET") { const sessions = await store.findMany("sessions", { professional_id: professional.id }, { sort: sortDate, limit: 500 }); const requestIds = sessions.map((session) => session.request_id); const [requests, referrals] = await Promise.all([requestIds.length ? store.findMany("requests", { id: { $in: requestIds } }, { limit: 500 }) : Promise.resolve([]), sessions.length ? store.findMany("referrals", { session_id: { $in: sessions.map((session) => session.id) } }, { limit: 500 }) : Promise.resolve([])]); const requestById = new Map(requests.map((record) => [record.id, record])); const referralBySession = new Map(referrals.map((referral) => [referral.session_id, referral])); return json(sessions.map((session) => { const record = requestById.get(session.request_id); return { ...session, meeting_mode: record?.meeting_mode || "online", meeting_location: record?.meeting_location || null, reason_code: record?.reason_code, reason_note: record?.reason_note, room_link: record?.room_link, referral: referralBySession.get(session.id) || null }; })); }
  const completeId = pathParameter(pathname, "/api/professionals/me/sessions/", "/complete");
  if (completeId && request.method === "POST") { const session = await store.findOne("sessions", { id: completeId, professional_id: professional.id }); if (!session) return fail("Conversa não encontrada", 404); if (session.status === "completed" || session.status === "no_show") return fail("Conversa já encerrada", 409); if (!sessionHasStarted(session)) return fail("A conversa só pode ser encerrada depois do horário marcado", 409); await store.update("sessions", { id: completeId }, { $set: { status: "completed", completed_at: now() } }); if (session.request_id) await store.update("requests", { id: session.request_id }, { $set: { status: "completed" } }); if (session.appointment_request_id) await store.update("appointment_requests", { id: session.appointment_request_id }, { $set: { status: "completed", completed_at: now() } }); const student = await store.findOne("students", { id: session.student_id }, { user_id: 1 }); if (student?.user_id) await notifyUser(env, String(student.user_id), "session_completed", "Conversa concluída", "Sua conversa foi marcada como realizada. Você já pode enviar seu feedback.", { session_id: completeId }); await notifyAdmins(env, store, "session_completed", "Conversa concluída no piloto", "Um encontro foi registrado como realizado. O conteúdo da conversa permanece privado.", { institution_id: professional.institution_id }); await refreshPanels(env, store, professional.institution_id, "institution"); await refreshPanels(env, store, professional.institution_id, "admin"); await logEvent(env, "session_completed", user, professional.institution_id, { session_id: completeId }); return json({ ok: true }); }
  const noShowId = pathParameter(pathname, "/api/professionals/me/sessions/", "/no-show");
  if (noShowId && request.method === "POST") { const session = await store.findOne("sessions", { id: noShowId, professional_id: professional.id }); if (!session) return fail("Conversa não encontrada", 404); if (session.status !== "scheduled") return fail("Esta conversa não está agendada", 409); if (!sessionHasStarted(session)) return fail("A ausência só pode ser registrada depois do horário marcado", 409); await store.update("sessions", { id: noShowId, professional_id: professional.id, status: "scheduled" }, { $set: { status: "no_show", no_show_at: now() } }); if (session.request_id) await store.update("requests", { id: session.request_id }, { $set: { status: "no_show" } }); if (session.appointment_request_id) await store.update("appointment_requests", { id: session.appointment_request_id }, { $set: { status: "no_show", no_show_at: now() } }); const student = await store.findOne("students", { id: session.student_id }, { user_id: 1 }); if (student?.user_id) await notifyUser(env, String(student.user_id), "session_no_show", "Conversa registrada como ausência", "A conversa foi registrada como não realizada. Se precisar, você pode solicitar um novo horário.", { session_id: noShowId }); await notifyAdmins(env, store, "session_no_show", "Ausência registrada no piloto", "Um encontro foi registrado como não realizado. O conteúdo da conversa permanece privado.", { institution_id: professional.institution_id }); await refreshPanels(env, store, professional.institution_id, "institution"); await refreshPanels(env, store, professional.institution_id, "admin"); await logEvent(env, "session_no_show", user, professional.institution_id, { session_id: noShowId }); return json({ ok: true }); }
  const referralId = pathParameter(pathname, "/api/professionals/me/sessions/", "/referral");
  if (referralId && request.method === "POST") { const payload = await requestBody(request), status = payload?.status; if (!oneOf(status, referralStatuses) || (payload?.note !== undefined && string(payload.note).length > 400)) return fail("Dados inválidos", 422); const session = await store.findOne("sessions", { id: referralId, professional_id: professional.id }); if (!session) return fail("Conversa não encontrada", 404); const referral = { id: id(), session_id: referralId, institution_id: professional.institution_id, status, note: payload?.note ? string(payload.note) : null, created_at: now() }; await store.update("referrals", { session_id: referralId }, { $set: referral }, true); const student = await store.findOne("students", { id: session.student_id }, { user_id: 1 }); if (student?.user_id) await notifyUser(env, String(student.user_id), "referral_registered", "Nova orientação disponível", "O profissional registrou uma orientação operacional após a conversa. Consulte seu histórico no Acolhe.", { session_id: referralId }); await notifyInstitutionManagers(env, store, professional.institution_id, "feedback_activity", "Nova atividade no piloto", "Uma conversa teve um desfecho operacional registrado. Os indicadores agregados foram atualizados.", { session_id: referralId }); await refreshPanels(env, store, professional.institution_id, "admin"); await logEvent(env, "referral_registered", user, professional.institution_id, { status }); return json(referral, 201); }
  return undefined;
}

async function institutionMetrics(env: Env, institutionId: string) {
  const store = db(env), [students, professionals, requests, sessions, appointmentRequests, availability] = await Promise.all([
    store.findMany("students", { institution_id: institutionId }, { projection: { last_access: 1 }, limit: 1000 }),
    store.findMany("professionals", { institution_id: institutionId }, { projection: { last_access: 1 }, limit: 200 }),
    store.findMany("requests", { institution_id: institutionId }, { projection: { created_at: 1, responded_at: 1, status: 1, student_id: 1 }, limit: 2000 }),
    store.findMany("sessions", { institution_id: institutionId }, { projection: { id: 1, status: 1 }, limit: 2000 }),
    store.findMany("appointment_requests", { institution_id: institutionId }, { projection: { created_at: 1, proposed_at: 1, responded_at: 1, status: 1, student_id: 1 }, limit: 2000 }),
    store.findMany("availability", { institution_id: institutionId, date: { $gte: localToday() } }, { projection: { status: 1, date: 1 }, limit: 3000 }),
  ]);
  const sessionIds = sessions.map((session) => session.id), [referrals, feedback] = await Promise.all([
    sessionIds.length ? store.findMany("referrals", { session_id: { $in: sessionIds } }, { projection: { status: 1 }, limit: 2000 }) : Promise.resolve([]),
    store.findMany("feedback", { institution_id: institutionId }, { projection: { score: 1 }, limit: 2000 }),
  ]);
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString(), byMonth: Record<string, number> = {}, referralsByStatus: Record<string, number> = {};
  for (const record of [...requests, ...appointmentRequests]) if (record.created_at) { const month = String(record.created_at).slice(0, 7); byMonth[month] = (byMonth[month] || 0) + 1; }
  for (const referral of referrals) referralsByStatus[String(referral.status)] = (referralsByStatus[String(referral.status)] || 0) + 1;
  const scores = feedback.map((entry) => Number(entry.score)).filter((score) => Number.isFinite(score) && score > 0), requestingStudents = new Set([...requests, ...appointmentRequests].map((record) => record.student_id));
  const allRequests = [...requests, ...appointmentRequests];
  const pendingFlow = allRequests.filter((record) => record.status === "pending").map(requestFlowMeta);
  const pendingDueSoon = pendingFlow.filter((meta) => meta.response_state === "due_soon").length;
  const pendingOverdue = pendingFlow.filter((meta) => meta.response_state === "overdue").length;
  const responseSamples = allRequests.map((record) => {
    const created = Date.parse(String(record.created_at || ""));
    const responded = Date.parse(String(record.responded_at || record.proposed_at || ""));
    return Number.isFinite(created) && Number.isFinite(responded) && responded >= created ? (responded - created) / 60_000 : null;
  }).filter((minutes): minutes is number => minutes !== null);
  const responseTimeMinutes = responseSamples.length >= 5 ? Math.round((responseSamples.reduce((sum, value) => sum + value, 0) / responseSamples.length) * 10) / 10 : null;
  const attendanceSessions = sessions.filter((session) => ["completed", "no_show"].includes(String(session.status)));
  const attendanceRate = attendanceSessions.length >= 5 ? Math.round((attendanceSessions.filter((session) => session.status === "completed").length / attendanceSessions.length) * 100) : null;
  const scheduledSessions = sessions.filter((session) => session.status === "scheduled");
  const observedDates = allRequests.map((record) => String(record.created_at || "").slice(0, 10)).filter(Boolean).sort();
  const periodStart = observedDates[0] || localToday();
  const periodEnd = localToday();
  const openSlots = availability.filter((slot) => slot.status === "open").length;
  const reservedSlots = availability.filter((slot) => slot.status === "reserved").length;
  const capacityTotal = openSlots + reservedSlots;
  return { students_registered: students.length, students_accessed: students.filter((student) => student.last_access).length, students_active_30d: students.filter((student) => student.last_access && String(student.last_access) >= cutoff).length, students_requested: requestingStudents.size, requests_total: allRequests.length, requests_pending: allRequests.filter((record) => record.status === "pending").length, requests_due_soon: pendingDueSoon, requests_overdue: pendingOverdue, requests_proposed: appointmentRequests.filter((record) => record.status === "proposed").length, requests_scheduled: scheduledSessions.length, requests_cancelled: allRequests.filter((record) => record.status === "cancelled").length, requests_declined: allRequests.filter((record) => record.status === "declined").length, response_time_minutes_avg: responseTimeMinutes, response_sample_size: responseSamples.length, responses_within_48h: responseSamples.length >= 5 ? Math.round((responseSamples.filter((minutes) => minutes <= 48 * 60).length / responseSamples.length) * 100) : null, attendance_rate: attendanceRate, attendance_sample_size: attendanceSessions.length, sessions_scheduled: scheduledSessions.length, sessions_completed: sessions.filter((session) => session.status === "completed").length, sessions_no_show: sessions.filter((session) => session.status === "no_show").length, referrals_total: referrals.length, referrals_by_status: referralsByStatus, professionals_linked: professionals.length, professionals_accessed: professionals.filter((professional) => professional.last_access).length, capacity_open_slots: openSlots, capacity_reserved_slots: reservedSlots, capacity_total_slots: capacityTotal, capacity_utilization_percent: capacityTotal ? Math.round((reservedSlots / capacityTotal) * 100) : null, requests_by_month: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, requests: count })), feedback_count: scores.length, feedback_average: scores.length >= 5 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null, metrics_period_label: "Desde o início do piloto", period_start: periodStart, period_end: periodEnd, baseline_available: false, minimum_sample_size: 5, has_data: Boolean(allRequests.length || sessions.length), data_source: "pilot" };
}

const impactMetricKeys = ["response_time_minutes_avg", "responses_within_48h", "attendance_rate", "capacity_utilization_percent", "requests_overdue", "referrals_total", "sessions_completed", "requests_total"] as const;
function buildImpactReport(metrics: Doc, baseline: Doc | null) {
  if (!baseline?.captured_at) return { baseline_available: false, captured_at: null, period_label: metrics.metrics_period_label, period_start: metrics.period_start, period_end: metrics.period_end, population: { requests: metrics.requests_total, students: metrics.students_requested, sessions: metrics.sessions_completed }, interpretation: "A variação futura será descritiva e não comprovará causalidade.", metrics: [] };
  const labels: Record<string, string> = { response_time_minutes_avg: "Tempo médio até resposta (min)", responses_within_48h: "Respostas em até 48h (%)", attendance_rate: "Comparecimento (%)", capacity_utilization_percent: "Capacidade utilizada (%)", requests_overdue: "Pedidos atrasados", referrals_total: "Encaminhamentos", sessions_completed: "Conversas realizadas", requests_total: "Pedidos recebidos" };
  return { baseline_available: true, captured_at: baseline.captured_at, period_label: metrics.metrics_period_label, period_start: baseline.period_start || metrics.period_start, period_end: metrics.period_end, population: { baseline: baseline.population || null, current: { requests: metrics.requests_total, students: metrics.students_requested, sessions: metrics.sessions_completed } }, interpretation: "Variação observada entre períodos; não é uma prova de causalidade nem de resultado clínico.", metrics: impactMetricKeys.map((key) => ({ key, label: labels[key], baseline: baseline[key] ?? null, current: metrics[key] ?? null, delta: baseline[key] != null && metrics[key] != null ? Math.round((Number(metrics[key]) - Number(baseline[key])) * 10) / 10 : null, sample_ready: baseline[key] != null && metrics[key] != null })) };
}

async function institutionProfessionals(store: ReturnType<typeof db>, institutionId: string) {
  const professionals = await store.findMany("professionals", { institution_id: institutionId }, { limit: 200 });
  const userIds = professionals.map((professional) => professional.user_id), professionalIds = professionals.map((professional) => professional.id);
  const [accounts, completedSessions] = await Promise.all([
    userIds.length ? store.findMany("users", { id: { $in: userIds } }, { projection: { id: 1, name: 1, email: 1, active: 1, invite_token: 1 }, limit: 200 }) : Promise.resolve([]),
    professionalIds.length ? store.findMany("sessions", { professional_id: { $in: professionalIds }, status: "completed" }, { projection: { professional_id: 1 }, limit: 1000 }) : Promise.resolve([]),
  ]);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const sessionsByProfessional = new Map<string, number>();
  for (const session of completedSessions) sessionsByProfessional.set(session.professional_id, (sessionsByProfessional.get(session.professional_id) || 0) + 1);
  return professionals.map((professional) => {
    const account = accountById.get(professional.user_id);
    return { id: professional.id, name: account?.name || "—", email: account?.email, active: account?.active !== false, link_type: professional.link_type, specialty: professional.specialty, completed_sessions: sessionsByProfessional.get(professional.id) || 0, invite_pending: Boolean(account?.invite_token), invite_path: account?.invite_token ? `/convite/${account.invite_token}` : null, last_access: professional.last_access };
  });
}

async function adminInstitutions(store: ReturnType<typeof db>, includeArchived = false): Promise<Doc[]> {
  const [institutions, students, professionals] = await Promise.all([
    store.findMany("institutions", {}, { limit: 200 }),
    store.findMany("students", {}, { projection: { institution_id: 1 }, limit: 1000 }),
    store.findMany("professionals", {}, { projection: { institution_id: 1 }, limit: 200 }),
  ]);
  const studentsByInstitution = new Map<string, number>(), professionalsByInstitution = new Map<string, number>();
  for (const student of students) studentsByInstitution.set(student.institution_id, (studentsByInstitution.get(student.institution_id) || 0) + 1);
  for (const professional of professionals) professionalsByInstitution.set(professional.institution_id, (professionalsByInstitution.get(professional.institution_id) || 0) + 1);
  return institutions
    .filter((institution) => includeArchived || institution.active !== false)
    .map((institution) => ({ ...institution, active: institution.active !== false, students: studentsByInstitution.get(institution.id) || 0, professionals: professionalsByInstitution.get(institution.id) || 0 }));
}

async function globalMetrics(env: Env, store: ReturnType<typeof db>, institutions: Doc[]) {
  const [perInstitution, users, students, professionals, requests, appointmentRequests, sessions, referrals, events, pendingInvites] = await Promise.all([
    Promise.all(institutions.map(async (institution) => ({ institution: institution.name, code: institution.code, ...await institutionMetrics(env, institution.id) }))),
    store.count("users"),
    store.findMany("students", {}, { projection: { last_access: 1 }, limit: 2000 }),
    store.count("professionals"),
    store.count("requests"),
    store.count("appointment_requests"),
    store.count("sessions", { status: "completed" }),
    store.count("referrals"),
    store.count("events"),
    store.count("users", { invite_token: { $exists: true } }),
  ]);
  return { institutions: institutions.length, users, students_registered: students.length, students_accessed: students.filter((student) => student.last_access).length, professionals, requests: requests + appointmentRequests, sessions_completed: sessions, referrals, events, pending_invites: pendingInvites, per_institution: perInstitution };
}

async function institutionRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (!pathname.startsWith("/api/institutions/")) return undefined;
  const identity = await getInstitution(request, env); if (isResponse(identity)) return identity;
  const { user, institution } = identity, store = db(env);
  if (pathname === "/api/institutions/me" && request.method === "GET") return json(institution);
  if (pathname === "/api/institutions/me/notifications" && request.method === "GET") {
    // Slot publication is part of the legacy student availability flow and is
    // no longer an institution-facing update in the current workflow.
    return json(await listNotificationsPage(env, user.id, { before: new URL(request.url).searchParams.get("before") || undefined, excludeTypes: ["availability_published", "availability_published_for_request"], includeUnreadCount: true }));
  }
  if (pathname === "/api/institutions/me/notifications/read" && request.method === "POST") { const payload = await requestBody(request), ids = Array.isArray(payload?.ids) ? payload.ids.filter((value: unknown): value is string => typeof value === "string").slice(0, 100) : []; if (ids.length) await store.updateMany("notifications", { recipient_user_id: user.id, id: { $in: ids } }, { $set: { read: true, read_at: now() } }); return json({ ok: true }); }
  const institutionNotificationId = pathParameter(pathname, "/api/institutions/me/notifications/", "/read");
  if (institutionNotificationId && request.method === "POST") { await store.update("notifications", { id: institutionNotificationId, recipient_user_id: user.id }, { $set: { read: true, read_at: now() } }); return json({ ok: true }); }
  if (pathname === "/api/institutions/me/dashboard" && request.method === "GET") {
    const [metrics, professionals] = await Promise.all([institutionMetrics(env, institution.id), institutionProfessionals(store, institution.id)]);
    const professionalIds = (await store.findMany("professionals", { institution_id: institution.id }, { projection: { id: 1 }, limit: 200 })).map((professional) => professional.id);
    const certificates = professionalIds.length ? await store.findMany("certificates", { professional_id: { $in: professionalIds } }, { sort: { issued_at: -1 }, limit: 500 }) : [];
    const [overdueRequests, overdueAppointments] = await Promise.all([
      store.findMany("requests", { institution_id: institution.id, status: "pending" }, { sort: { created_at: 1 }, limit: 100 }),
      store.findMany("appointment_requests", { institution_id: institution.id, status: "pending" }, { sort: { created_at: 1 }, limit: 100 }),
    ]);
    const fallbackRequests = [...overdueRequests, ...overdueAppointments].map((record) => ({ id: record.id, kind: overdueRequests.some((item) => item.id === record.id) ? "request" : "direct", created_at: record.created_at, ...requestFlowMeta(record) })).filter((record) => record.response_state === "overdue");
    const minorRegistrations = await store.findMany("users", { institution_id: institution.id, role: "student", age_band: "child", guardian_review_status: "pending_institution_review" }, { projection: { id: 1, name: 1, guardian_name: 1, guardian_email: 1, created_at: 1 }, sort: { created_at: 1 }, limit: 100 });
    return json({ institution, metrics, impact_report: buildImpactReport(metrics, institution.impact_baseline || null), professionals, minor_registrations: minorRegistrations, fallback_requests: fallbackRequests, certificates: certificates.map((certificate) => ({ id: certificate.id, code: certificate.code, title: certificate.title, professional_name: certificate.professional_name, completed_count: certificate.completed_count, issued_at: certificate.issued_at, status: certificate.status, revoked_at: certificate.revoked_at || null })) });
  }
  const minorApprovalId = pathParameter(pathname, "/api/institutions/me/minor-registrations/", "/approve");
  if (minorApprovalId && request.method === "POST") {
    const minor = await store.findOne("users", { id: minorApprovalId, institution_id: institution.id, role: "student", age_band: "child", guardian_review_status: "pending_institution_review" });
    if (!minor) return fail("Cadastro infantil não encontrado ou já revisado", 404);
    if (await store.update("users", { id: minorApprovalId, institution_id: institution.id, guardian_review_status: "pending_institution_review" }, { $set: { active: true, guardian_review_status: "approved", guardian_reviewed_at: now(), guardian_reviewed_by: user.id } }) === 0) return fail("Cadastro infantil já foi revisado", 409);
    try { await logEvent(env, "minor_registration_approved", user, institution.id, { student_user_id: minorApprovalId }); }
    catch { await store.update("users", { id: minorApprovalId, institution_id: institution.id, guardian_review_status: "approved" }, { $set: { active: false, guardian_review_status: "pending_institution_review" }, $unset: { guardian_reviewed_at: "", guardian_reviewed_by: "" } }); return fail("Não foi possível registrar a auditoria da liberação. Tente novamente.", 503); }
    await notifyUser(env, minorApprovalId, "minor_registration_approved", "Acesso liberado", "A instituição validou o cadastro do responsável. Você já pode entrar no Acolhe.");
    return json({ ok: true });
  }
  if (pathname === "/api/institutions/me/impact/baseline" && request.method === "POST") {
    const metrics = await institutionMetrics(env, institution.id);
    const baseline: Doc = { captured_at: now(), metrics_period_label: metrics.metrics_period_label, period_start: metrics.period_start, period_end: metrics.period_end, population: { requests: metrics.requests_total, students: metrics.students_requested, sessions: metrics.sessions_completed } };
    for (const key of impactMetricKeys) baseline[key] = metrics[key] ?? null;
    await store.update("institutions", { id: institution.id }, { $set: { impact_baseline: baseline } });
    await logEvent(env, "impact_baseline_captured", user, institution.id, { captured_at: baseline.captured_at });
    return json(buildImpactReport(metrics, baseline), 201);
  }
  const fallbackId = pathParameter(pathname, "/api/institutions/me/requests/", "/fallback");
  if (fallbackId && request.method === "POST") {
    const payload = await requestBody(request), action = string(payload?.action);
    if (!oneOf(action, ["contact_student", "offer_other_professional", "queue_support"])) return fail("Escolha um próximo passo válido", 422);
    let record = await store.findOne("requests", { id: fallbackId, institution_id: institution.id, status: "pending" });
    let collection = "requests";
    if (!record) { record = await store.findOne("appointment_requests", { id: fallbackId, institution_id: institution.id, status: "pending" }); collection = "appointment_requests"; }
    if (!record) return fail("Este pedido não está mais pendente", 409);
    const update = { fallback_action: action, fallback_at: now(), fallback_by: user.id };
    await store.update(collection, { id: fallbackId, institution_id: institution.id, status: "pending" }, { $set: update });
    const student = await store.findOne("students", { id: record.student_id }, { user_id: 1 });
    const messages: Record<string, string> = { contact_student: "A instituição vai entrar em contato para definir o próximo passo.", offer_other_professional: "A instituição está verificando outra opção de profissional. Você será avisado antes de qualquer mudança.", queue_support: "A instituição registrou seu pedido na fila de apoio e vai orientar o próximo passo." };
    if (student?.user_id) await notifyUser(env, String(student.user_id), "request_fallback_reviewed", "Próximo passo do pedido", messages[action], { request_id: fallbackId, action });
    await logEvent(env, "request_fallback_reviewed", user, institution.id, { request_id: fallbackId, action });
    await refreshPanels(env, store, institution.id, "institution");
    return json({ ok: true, action, message: messages[action] });
  }
  if (pathname === "/api/institutions/me" && request.method === "PUT") { const payload = await requestBody(request); if (!payload) return fail("Corpo JSON inválido", 422); const patch: Doc = {}; if (payload.name !== undefined) { const value = string(payload.name); if (value.length < 2 || value.length > 120) return fail("Dados inválidos", 422); patch.name = value; } if (payload.contact_email !== undefined) { const value = email(payload.contact_email); if (!value) return fail("Dados inválidos", 422); patch.contact_email = value; } if (payload.support_note !== undefined) { const value = string(payload.support_note); if (value.length > 400) return fail("Dados inválidos", 422); patch.support_note = value || null; } if (payload.onboarding_steps !== undefined) { if (!Array.isArray(payload.onboarding_steps) || payload.onboarding_steps.some((step: unknown) => typeof step !== "string" || step.length > 60)) return fail("Checklist inválido", 422); patch.onboarding_steps = [...new Set(payload.onboarding_steps)].slice(0, 12); } if (Object.keys(patch).length) await store.update("institutions", { id: institution.id }, { $set: patch }); return json(await store.findOne("institutions", { id: institution.id })); }
  if (pathname === "/api/institutions/me/students" && request.method === "GET") return json({ visible: false, message: "A relação nominal de estudantes não é disponibilizada. Consulte os indicadores agregados do piloto." });
  if (pathname === "/api/institutions/me/professionals" && request.method === "GET") return json(await institutionProfessionals(store, institution.id));
  if (pathname === "/api/institutions/me/professionals" && request.method === "POST") { const payload = await requestBody(request), name = string(payload?.name), address = email(payload?.email), linkType = payload?.link_type === undefined ? "institution" : payload.link_type, specialty = payload?.specialty === undefined ? null : string(payload.specialty); if (name.length < 2 || name.length > 90 || !address || !oneOf(linkType, ["institution", "partner"]) || (specialty && specialty.length > 120)) return fail("Dados inválidos", 422); if (await store.findOne("users", { email: address })) return fail("Este e-mail já possui conta", 409); const invite = tokenSecret(), account = { id: id(), name, email: address, password_hash: "", role: "professional", institution_id: institution.id, active: false, invite_token: invite, invite_expires_at: isoAfter(14, "days"), created_at: now() }, professional = { id: id(), user_id: account.id, institution_id: institution.id, link_type: linkType, specialty, created_at: now(), last_access: null }; try { await store.insert("users", account); await store.insert("professionals", professional); } catch (error) { await store.remove("professionals", { id: professional.id }, true); await store.remove("users", { id: account.id }, true); console.error("Professional invitation rolled back", error); return fail("Não foi possível criar o convite. Verifique o e-mail e tente novamente.", 503); } const inviteUrl = `${new URL(env.FRONTEND_URL).origin}/convite/${invite}`; await sendNotificationEmail(env, address, "Convite para entrar no Acolhe", `Olá, ${name}. Você foi convidado(a) para atuar como profissional no Acolhe. Abra este link para definir sua senha e ativar o acesso:\n\n${inviteUrl}`); await refreshPanels(env, store, institution.id, "admin"); await logEvent(env, "professional_invited", user, institution.id, { professional_id: professional.id }); return json({ id: professional.id, name, email: address, link_type: linkType, invite_path: `/convite/${invite}`, note: "O profissional define a própria senha ao abrir o convite." }, 201); }
  if (pathname === "/api/institutions/me/metrics" && request.method === "GET") return json(await institutionMetrics(env, institution.id));
  return undefined;
}

async function adminRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (!pathname.startsWith("/api/admin/") && pathname !== "/api/metrics/global") return undefined;
  const admin = await userWithRole(request, env, ["admin"]); if (isResponse(admin)) return admin;
  const store = db(env);
  if (pathname === "/api/admin/notifications" && request.method === "GET") return json(await listNotificationsPage(env, admin.id, { before: new URL(request.url).searchParams.get("before") || undefined, includeUnreadCount: true }));
  if (pathname === "/api/admin/notifications/read" && request.method === "POST") { const payload = await requestBody(request), ids = Array.isArray(payload?.ids) ? payload.ids.filter((value: unknown): value is string => typeof value === "string").slice(0, 100) : []; if (ids.length) await store.updateMany("notifications", { recipient_user_id: admin.id, id: { $in: ids } }, { $set: { read: true, read_at: now() } }); return json({ ok: true }); }
  const adminNotificationId = pathParameter(pathname, "/api/admin/notifications/", "/read");
  if (adminNotificationId && request.method === "POST") { await store.update("notifications", { id: adminNotificationId, recipient_user_id: admin.id }, { $set: { read: true, read_at: now() } }); return json({ ok: true }); }
  const publicLead = (lead: Doc) => { const { manager_password_hash: _hidden, ...safeLead } = lead; return safeLead; };
  if (pathname === "/api/admin/dashboard" && request.method === "GET") {
    const institutionsPromise = adminInstitutions(store, true);
    const [users, requests, appointmentRequests, leads, institutions, certificates] = await Promise.all([
      store.findMany("users", {}, { projection: { password_hash: 0, invite_token: 0, invite_expires_at: 0, session_version: 0 }, sort: { created_at: -1 }, limit: 500 }),
      store.findMany("requests", {}, { projection: { reason_note: 0 }, sort: { created_at: -1 }, limit: 500 }),
      store.findMany("appointment_requests", {}, { projection: { note: 0, reason_note: 0 }, sort: { created_at: -1 }, limit: 500 }),
      store.findMany("leads", {}, { sort: { created_at: -1 }, limit: 200 }),
      institutionsPromise,
      store.findMany("certificates", {}, { sort: { issued_at: -1 }, limit: 500 }),
    ]);
    const institutionNames = new Map(institutions.map((institution) => [institution.id, institution.name]));
    const activeInstitutions = institutions.filter((institution) => institution.active !== false);
    const archivedInstitutions = institutions.filter((institution) => institution.active === false);
    const metrics = await globalMetrics(env, store, activeInstitutions);
    const combinedRequests: Doc[] = [...requests.map((record) => ({ ...(record as Doc), request_kind: "availability" })), ...appointmentRequests.map((record) => ({ ...(record as Doc), request_kind: "direct" }))].sort((a, b) => String((b as Doc).created_at || "").localeCompare(String((a as Doc).created_at || "")));
    return json({ users: users.map((user) => ({ ...user, institution_name: institutionNames.get(user.institution_id) })), institutions: activeInstitutions, archived_institutions: archivedInstitutions, requests: combinedRequests.map((record) => ({ ...record, institution_name: institutionNames.get(record.institution_id) })), leads: leads.map(publicLead), certificates: certificates.map((certificate) => ({ id: certificate.id, code: certificate.code, title: certificate.title, professional_name: certificate.professional_name, professional_id: certificate.professional_id, institution_name: certificate.institution_name || institutionNames.get(certificate.institution_id) || "Piloto Acolhe", completed_count: certificate.completed_count, issued_at: certificate.issued_at, status: certificate.status, revoked_at: certificate.revoked_at || null })), metrics });
  }
  const revokeCertificateId = pathParameter(pathname, "/api/admin/certificates/", "/revoke");
  if (revokeCertificateId && request.method === "POST") {
    const certificate = await store.findOne("certificates", { id: revokeCertificateId });
    if (!certificate) return fail("Certificado não encontrado", 404);
    if (certificate.status === "revoked") return fail("Certificado já está revogado", 409);
    await store.update("certificates", { id: revokeCertificateId, status: "valid" }, { $set: { status: "revoked", revoked_at: now(), revoked_by: admin.id } });
    await logEvent(env, "certificate_revoked", admin, certificate.institution_id, { certificate_id: certificate.id, code: certificate.code, professional_id: certificate.professional_id });
    return json({ id: certificate.id, code: certificate.code, status: "revoked", revoked_at: now() });
  }
  if (pathname === "/api/admin/leads" && request.method === "GET") return json((await store.findMany("leads", {}, { sort: { created_at: -1 }, limit: 200 })).map(publicLead));
  const deleteLeadId = request.method === "DELETE" && pathname.startsWith("/api/admin/leads/") ? decodeURIComponent(pathname.slice("/api/admin/leads/".length)) : undefined;
  if (deleteLeadId) {
    const lead = await store.findOne("leads", { id: deleteLeadId });
    if (!lead) return fail("Interesse não encontrado", 404);
    await store.remove("leads", { id: deleteLeadId }, true);
    await logEvent(env, "lead_deleted", admin, lead.institution_id, { target: deleteLeadId, kind: lead.kind });
    return json({ id: deleteLeadId, deleted: true });
  }
  const leadId = pathParameter(pathname, "/api/admin/leads/", "/status");
  if (leadId && request.method === "POST") {
    const payload = await requestBody(request), status = payload?.status;
    if (!oneOf(status, leadStatuses)) return fail("Status inválido", 422);
    const lead = await store.findOne("leads", { id: leadId }); if (!lead) return fail("Interesse não encontrado", 404);
    if (lead.kind === "professional" && status === "approved") {
      return fail("Interesses profissionais não criam contas. Use um convite da instituição para criar o acesso.", 422);
    }
    let account_created = false, institution_code: string | undefined;
    if (status === "approved" && lead.status !== "approved" && lead.status !== "contacted") {
      const existing = await store.findOne("users", { email: lead.email });
      if (existing && lead.kind === "institution") return fail("Este e-mail já possui uma conta. Use outro e-mail para criar o acesso institucional.", 409);
      if (!existing) {
        if (lead.kind === "institution") {
          institution_code = `PILOTO-${id().slice(0, 8).toUpperCase()}`;
          const institution = { id: id(), name: String(lead.institution || lead.name), code: institution_code, contact_email: lead.email, plan: "piloto", support_note: null, active: true, lead_id: lead.id, created_at: now() };
          const manager = lead.manager_password_hash ? { id: id(), name: String(lead.name), email: lead.email, password_hash: lead.manager_password_hash, role: "institution", institution_id: institution.id, active: true, session_version: 0, created_at: now() } : null;
          try {
            await store.insert("institutions", institution);
            if (manager) {
              await store.insert("users", manager);
              account_created = true;
            }
          } catch (error) {
            if (manager) await store.remove("users", { id: manager.id }, true);
            await store.remove("institutions", { id: institution.id }, true);
            console.error("Institution lead approval rolled back", error);
            return fail("Não foi possível criar a instituição e o acesso do gestor. Tente novamente.", 503);
          }
        }
      }
    }
    const updated_at = now();
    const leadUpdate: Doc = { $set: { status, updated_at, ...(account_created ? { account_created_at: updated_at, account_email: lead.email, ...(institution_code ? { institution_code } : {}) } : {}) } };
    if (account_created) leadUpdate.$unset = { manager_password_hash: "" };
    await store.update("leads", { id: leadId }, leadUpdate);
    if (account_created && institution_code) {
      const loginUrl = `${new URL(env.FRONTEND_URL).origin}/login`;
      await sendNotificationEmail(env, String(lead.email), "Acesso institucional aprovado", `Sua instituição foi aprovada no Acolhe.\n\nCódigo da instituição: ${institution_code}\nAcesse: ${loginUrl}\n\nUse a senha informada no formulário de interesse.`);
    }
    await refreshPanels(env, store, "", "admin");
    return json({ ...publicLead(lead), status, updated_at, account_created, ...(institution_code ? { institution_code } : {}) });
  }
  if (pathname === "/api/admin/users" && request.method === "GET") { const [users, institutions] = await Promise.all([store.findMany("users", {}, { projection: { password_hash: 0, invite_token: 0, invite_expires_at: 0, session_version: 0 }, sort: { created_at: -1 }, limit: 500 }), store.findMany("institutions", {}, { limit: 200 })]), names = new Map(institutions.map((institution) => [institution.id, institution.name])); return json(users.map((user) => ({ ...user, institution_name: names.get(user.institution_id) }))); }
  const deleteUserId = request.method === "DELETE" && pathname.startsWith("/api/admin/users/") ? decodeURIComponent(pathname.slice("/api/admin/users/".length)) : undefined;
  if (deleteUserId) {
    const target = await store.findOne("users", { id: deleteUserId });
    if (!target) return fail("Usuário não encontrado", 404);
    if (target.role === "admin") return fail("Não é possível excluir um administrador", 403);
    const deleted = await store.deleteAccount(target.id, { kind: "admin", adminId: admin.id });
    if (!deleted) return fail("Usuário não encontrado", 404);
    return json({ id: deleted.id, deleted: true });
  }
  const targetId = pathParameter(pathname, "/api/admin/users/", "/toggle-active");
  if (targetId && request.method === "POST") { const target = await store.findOne("users", { id: targetId }); if (!target) return fail("Usuário não encontrado", 404); if (target.role === "admin") return fail("Não é possível desativar um administrador", 403); const active = target.active === false; await store.update("users", { id: targetId }, { $set: { active } }); if (target.email) await sendNotificationEmail(env, String(target.email), active ? "Acesso reativado" : "Acesso desativado", active ? "Seu acesso ao Acolhe foi reativado." : "Seu acesso ao Acolhe foi desativado pela administração."); if (target.institution_id) await notifyInstitutionManagers(env, store, String(target.institution_id), "user_access_toggled", active ? "Acesso reativado" : "Acesso desativado", `O acesso de ${target.name} foi ${active ? "reativado" : "desativado"}.`, { target_id: targetId }); await refreshPanels(env, store, String(target.institution_id || ""), "admin"); await logEvent(env, "user_access_toggled", admin, target.institution_id, { target: targetId, active }); return json({ id: targetId, active }); }
  if (pathname === "/api/admin/institutions" && request.method === "GET") return json(await adminInstitutions(store));
  if (pathname === "/api/admin/institutions" && request.method === "POST") { const payload = await requestBody(request), name = string(payload?.name), code = string(payload?.code).toUpperCase(), contact = payload?.contact_email === undefined || payload.contact_email === null ? null : email(payload.contact_email), adminEmail = payload?.admin_email === undefined || payload.admin_email === null ? null : email(payload.admin_email), adminPassword = payload?.admin_password; if (name.length < 2 || name.length > 120 || code.length < 3 || code.length > 40 || (payload?.contact_email && !contact) || (payload?.admin_email && !adminEmail) || (adminPassword !== undefined && adminPassword !== null && !validPassword(adminPassword))) return fail("Dados inválidos", 422); if (adminEmail && !validPassword(adminPassword)) return fail("Defina uma senha individual para o acesso institucional", 422); if (await store.findOne("institutions", { code, active: { $ne: false } })) return fail("Código de instituição já utilizado", 409); if (adminEmail && await store.findOne("users", { email: adminEmail })) return fail("E-mail do gestor já possui conta", 409); const institution = { id: id(), name, code, contact_email: contact, plan: "piloto", support_note: null, active: true, created_at: now() }; const manager = adminEmail ? { id: id(), name: string(payload?.admin_name) || name, email: adminEmail, password_hash: await hashPassword(adminPassword as string), role: "institution", institution_id: institution.id, active: true, session_version: 0, created_at: now() } : null; try { await store.insert("institutions", institution); if (manager) await store.insert("users", manager); } catch (error) { if (manager) await store.remove("users", { id: manager.id }, true); await store.remove("institutions", { id: institution.id }, true); console.error("Institution creation rolled back", error); return fail("Não foi possível criar a instituição. Tente novamente.", 503); } await logEvent(env, "institution_created", admin, institution.id); return json(institution, 201); }
  const institutionId = request.method === "DELETE" && pathname.startsWith("/api/admin/institutions/") ? decodeURIComponent(pathname.slice("/api/admin/institutions/".length)) : undefined;
  if (institutionId) {
    const target = await store.findOne("institutions", { id: institutionId });
    if (!target) return fail("Instituição não encontrada", 404);
    if (target.active === false) return fail("Instituição já está arquivada", 409);
    const changed = await store.update("institutions", { id: institutionId, active: { $ne: false } }, { $set: { active: false, archived_at: now() } });
    if (changed !== 1) return fail("Instituição já foi arquivada", 409);
    // Invalidate already-issued sessions so archived institutions lose access immediately.
    await store.updateMany("users", { institution_id: institutionId, active: { $ne: false } }, { $inc: { session_version: 1 } });
    await notifyInstitutionManagers(env, store, institutionId, "institution_archived", "Instituição arquivada", "O acesso da instituição foi arquivado pela administração.", { institution_id: institutionId });
    await refreshPanels(env, store, institutionId, "admin");
    await logEvent(env, "institution_archived", admin, institutionId, { code: target.code });
    return json({ id: institutionId, archived: true });
  }
  const restoreInstitutionId = pathParameter(pathname, "/api/admin/institutions/", "/restore");
  if (restoreInstitutionId && request.method === "POST") {
    const target = await store.findOne("institutions", { id: restoreInstitutionId });
    if (!target) return fail("Instituição não encontrada", 404);
    const changed = await store.update("institutions", { id: restoreInstitutionId }, { $set: { active: true }, $unset: { archived_at: "" } });
    if (changed !== 1 && target.active !== true) return fail("Não foi possível reativar a instituição", 503);
    await notifyInstitutionManagers(env, store, restoreInstitutionId, "institution_restored", "Instituição reativada", "O acesso da instituição foi reativado pela administração.", { institution_id: restoreInstitutionId });
    await refreshPanels(env, store, restoreInstitutionId, "admin");
    await logEvent(env, "institution_restored", admin, restoreInstitutionId, { code: target.code });
    return json({ id: restoreInstitutionId, active: true });
  }
  if (pathname === "/api/admin/requests" && request.method === "GET") { const records = await store.findMany("requests", {}, { projection: { id: 1, date: 1, time: 1, status: 1, institution_id: 1 }, sort: { created_at: -1 }, limit: 500 }), institutions = await store.findMany("institutions", {}, { limit: 200 }), names = new Map(institutions.map((institution) => [institution.id, institution.name])); return json(records.map((record) => ({ id: record.id, date: record.date, time: record.time, status: record.status, institution_name: names.get(record.institution_id) || "Instituição" }))); }
  if (pathname === "/api/metrics/global" && request.method === "GET") { const institutions = await store.findMany("institutions", {}, { limit: 200 }); return json(await globalMetrics(env, store, institutions)); }
  return undefined;
}

export async function apiRoute(request: Request, env: Env, pathname: string): Promise<Response> {
  if (pathname === "/api" || pathname === "/api/") return json({ service: "acolhe-mvp", status: "ok", runtime: "cloudflare-worker" });
  for (const route of [publicRoutes, authRoutes, studentRoutes, professionalRoutes, institutionRoutes, adminRoutes]) { const response = await route(request, env, pathname); if (response) return response; }
  return fail("Não encontrado", 404);
}
