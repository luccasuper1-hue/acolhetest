import { createAccessToken, hashPassword, verifyPassword } from "./auth";
import { clearCookie, cookie, currentUser, db, email, fail, id, isResponse, json, logEvent, now, oneOf, profile, publicUser, requestBody, string, tokenSecret, userWithRole, type Doc } from "./core";
import type { Env } from "./index";

const roles = ["student", "professional", "institution", "admin"] as const;
const reasonCodes = ["conversar", "dificuldade", "orientacao", "outro"] as const;
const referralStatuses = ["orientacao", "encaminhamento_interno", "encaminhamento_externo", "sem_encaminhamento"] as const;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const pathParameter = (pathname: string, prefix: string, suffix = "") => pathname.startsWith(prefix) && pathname.endsWith(suffix) ? decodeURIComponent(pathname.slice(prefix.length, suffix ? -suffix.length : undefined)) : undefined;
const isoAfter = (hoursOrDays: number, kind: "hours" | "days") => new Date(Date.now() + hoursOrDays * (kind === "hours" ? 3_600_000 : 86_400_000)).toISOString();
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const validPassword = (value: unknown) => typeof value === "string" && value.length >= 8 && value.length <= 128;
const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const sortDate = { date: 1 as const, time: 1 as const };

async function sendResetEmail(env: Env, recipient: string, token: string): Promise<boolean> {
  if (!env.RESET_EMAIL_WEBHOOK_URL || !env.RESET_EMAIL_WEBHOOK_TOKEN) return false;
  let endpoint: URL, frontend: URL;
  try {
    endpoint = new URL(env.RESET_EMAIL_WEBHOOK_URL);
    frontend = new URL(env.FRONTEND_URL);
  } catch { return false; }
  if (endpoint.protocol !== "https:" || frontend.protocol !== "https:" || frontend.pathname !== "/" || frontend.search || frontend.hash) return false;
  const resetUrl = `${frontend.origin}/redefinir-senha?token=${encodeURIComponent(token)}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESET_EMAIL_WEBHOOK_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ to: recipient, subject: "Redefinir senha do Acolhe", text: `Para redefinir sua senha, abra este link em até 1 hora:\n\n${resetUrl}\n` }),
    });
    return response.ok;
  } catch { return false; }
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
  if (name.length < 2 || name.length > 90 || !address || !validPassword(password) || code.length < 3 || code.length > 40) return fail("Dados de cadastro inválidos", 422);
  if (payload.consent !== true) return fail("É necessário aceitar os termos de uso do piloto", 422);
  const store = db(env), institution = await store.findOne("institutions", { code });
  if (!institution) return fail("Código de instituição não encontrado", 404);
  if (await store.findOne("users", { email: address }, { id: 1 })) return fail("Este e-mail já possui conta", 409);
  const user = { id: id(), name, email: address, password_hash: await hashPassword(password as string), role: "student", institution_id: institution.id, active: true, consent_accepted_at: now(), created_at: now() };
  try { await store.insert("users", user); } catch { return fail("Este e-mail já possui conta", 409); }
  await store.insert("students", { id: id(), user_id: user.id, institution_id: institution.id, created_at: now(), last_access: null });
  await logEvent(env, "student_registered", user, institution.id);
  const accessToken = await createAccessToken({ sub: user.id, email: address, role: "student" }, env.JWT_SECRET);
  return json({ user: publicUser(user), access_token: accessToken, institution: institution.name }, 200, cookie(accessToken));
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
  await store.remove("login_attempts", { identifier: address });
  if (user.role === "student") await store.update("students", { user_id: user.id }, { $set: { last_access: now() } });
  if (user.role === "professional") await store.update("professionals", { user_id: user.id }, { $set: { last_access: now() } });
  await logEvent(env, "access", user, user.institution_id);
  const accessToken = await createAccessToken({ sub: user.id, email: address, role: user.role }, env.JWT_SECRET);
  return json({ user: publicUser(user), access_token: accessToken }, 200, cookie(accessToken));
}

async function authRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  const store = db(env);
  if (pathname === "/api/auth/register" && request.method === "POST") return register(request, env);
  if (pathname === "/api/auth/login" && request.method === "POST") return login(request, env);
  if (pathname === "/api/auth/logout" && request.method === "POST") return json({ ok: true }, 200, clearCookie());
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = await currentUser(request, env); if (isResponse(user)) return user;
    const institution = user.institution_id ? await store.findOne("institutions", { id: user.institution_id }) : null;
    return json({ user: publicUser(user), institution });
  }
  const inviteToken = pathParameter(pathname, "/api/auth/invite/");
  if (inviteToken && request.method === "GET") {
    const user = await store.findOne("users", { invite_token: inviteToken });
    if (!user) return fail("Convite inválido ou já utilizado", 404);
    if (user.invite_expires_at && String(user.invite_expires_at) < now()) return fail("Convite expirado. Peça um novo à instituição.", 410);
    const institution = await store.findOne("institutions", { id: user.institution_id });
    return json({ name: user.name, email: user.email, role: user.role, institution: institution?.name });
  }
  const acceptToken = pathParameter(pathname, "/api/auth/invite/", "/accept");
  if (acceptToken && request.method === "POST") {
    const payload = await requestBody(request); if (!payload || !validPassword(payload.password)) return fail("Senha inválida", 422);
    const user = await store.findOne("users", { invite_token: acceptToken });
    if (!user) return fail("Convite inválido ou já utilizado", 404);
    if (user.invite_expires_at && String(user.invite_expires_at) < now()) return fail("Convite expirado. Peça um novo à instituição.", 410);
    const changed = await store.update("users", { id: user.id, invite_token: acceptToken }, { $set: { password_hash: await hashPassword(payload.password), active: true, consent_accepted_at: now() }, $unset: { invite_token: "", invite_expires_at: "" } });
    if (changed !== 1) return fail("Convite inválido ou já utilizado", 404);
    await logEvent(env, "invite_accepted", user, user.institution_id);
    const accessToken = await createAccessToken({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET);
    return json({ user: publicUser({ ...user, active: true }), access_token: accessToken }, 200, cookie(accessToken));
  }
  if (pathname === "/api/auth/forgot-password" && request.method === "POST") {
    const payload = await requestBody(request), address = email(payload?.email); if (!address) return fail("E-mail inválido", 422);
    const pilotReset = env.PILOT_RETURN_RESET_TOKEN === "true" && env.APP_ENV !== "production";
    const emailEnabled = Boolean(env.RESET_EMAIL_WEBHOOK_URL && env.RESET_EMAIL_WEBHOOK_TOKEN);
    if (!pilotReset && !emailEnabled) return fail("Recuperação de senha indisponível. Fale com a operação do Acolhe.", 503);
    const generic: Doc = { ok: true, message: "Se o e-mail existir, as instruções de redefinição serão enviadas." };
    const user = await store.findOne("users", { email: address }); if (!user) return json(generic);
    const resetToken = tokenSecret();
    await store.insert("password_reset_tokens", { id: id(), user_id: user.id, token: resetToken, expires_at: isoAfter(1, "hours"), used: false, created_at: now() });
    if (pilotReset) return json({ ...generic, reset_token: resetToken, pilot_note: "PROVISÓRIO PARA PILOTO: envio por e-mail é P1." });
    await sendResetEmail(env, address, resetToken);
    return json(generic);
  }
  if (pathname === "/api/auth/reset-password" && request.method === "POST") {
    const payload = await requestBody(request); if (!payload || !string(payload.token) || !validPassword(payload.password)) return fail("Dados inválidos", 422);
    const reset = await store.findOneAndUpdate("password_reset_tokens", { token: string(payload.token), used: false, expires_at: { $gt: now() } }, { $set: { used: true } });
    if (!reset) return fail("Link inválido ou expirado", 400);
    await store.update("users", { id: reset.user_id }, { $set: { password_hash: await hashPassword(payload.password) } });
    return json({ ok: true });
  }
  return undefined;
}

async function studentRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (!pathname.startsWith("/api/students/")) return undefined;
  const identity = await getStudent(request, env); if (isResponse(identity)) return identity;
  const { user, student } = identity, store = db(env);
  if (pathname === "/api/students/me" && request.method === "GET") return json({ student, name: user.name, institution: await store.findOne("institutions", { id: student.institution_id }) });
  if (pathname === "/api/students/me/professionals" && request.method === "GET") {
    const professionals = await store.findMany("professionals", { institution_id: student.institution_id }, { limit: 100 }); const out: Doc[] = [];
    for (const professional of professionals) {
      const professionalUser = await store.findOne("users", { id: professional.user_id }); if (!professionalUser || professionalUser.active === false) continue;
      const slots = await store.findMany("availability", { professional_id: professional.id, status: "open" }, { sort: sortDate, limit: 100 });
      out.push({ id: professional.id, name: professionalUser.name, specialty: professional.specialty, link_type: professional.link_type, slots });
    } return json(out);
  }
  if (pathname === "/api/students/me/requests" && request.method === "POST") {
    const payload = await requestBody(request), availabilityId = string(payload?.availability_id), reason = payload?.reason_code;
    if (!availabilityId || !oneOf(reason, reasonCodes) || (payload?.reason_note !== undefined && string(payload.reason_note).length > 500)) return fail("Dados inválidos", 422);
    const slot = await store.findOne("availability", { id: availabilityId });
    if (!slot || slot.institution_id !== student.institution_id) return fail("Horário não encontrado", 404);
    if (await store.update("availability", { id: slot.id, status: "open" }, { $set: { status: "reserved" } }) === 0) return fail("Este horário acabou de ser reservado. Escolha outro.", 409);
    const record = { id: id(), student_id: student.id, professional_id: slot.professional_id, institution_id: student.institution_id, availability_id: slot.id, date: slot.date, time: slot.time, reason_code: reason, reason_note: payload?.reason_note ? string(payload.reason_note) : null, status: "pending", created_at: now() };
    await store.insert("requests", record); await logEvent(env, "request_created", user, student.institution_id, { reason_code: reason }); return json(record, 201);
  }
  if (pathname === "/api/students/me/requests" && request.method === "GET") {
    const records = await store.findMany("requests", { student_id: student.id }, { sort: sortDate, limit: 200 }); const out: Doc[] = [];
    for (const record of records) { const pro = await store.findOne("professionals", { id: record.professional_id }); const proUser = pro ? await store.findOne("users", { id: pro.user_id }) : null; const session = await store.findOne("sessions", { request_id: record.id }); const referral = session ? await store.findOne("referrals", { session_id: session.id }) : null; const feedback = session ? await store.findOne("feedback", { session_id: session.id }) : null; out.push({ ...record, professional_name: proUser?.name || "Profissional", session, referral, feedback }); } return json(out);
  }
  const cancelId = pathParameter(pathname, "/api/students/me/requests/", "/cancel");
  if (cancelId && request.method === "POST") { const record = await store.findOne("requests", { id: cancelId, student_id: student.id }); if (!record) return fail("Solicitação não encontrada", 404); if (!(record.status === "pending" || record.status === "accepted")) return fail("Esta solicitação não pode mais ser cancelada", 409); if (await store.update("requests", { id: cancelId, student_id: student.id, status: { $in: ["pending", "accepted"] } }, { $set: { status: "cancelled" } }) === 0) return fail("Esta solicitação não pode mais ser cancelada", 409); await store.update("availability", { id: record.availability_id, status: "reserved" }, { $set: { status: "open" } }); await store.remove("sessions", { request_id: cancelId, status: "scheduled" }, true); await logEvent(env, "request_cancelled", user, student.institution_id, { request_id: cancelId }); return json({ ok: true }); }
  const feedbackId = pathParameter(pathname, "/api/students/me/sessions/", "/feedback");
  if (feedbackId && request.method === "POST") { const payload = await requestBody(request), score = Number(payload?.score); if (!Number.isInteger(score) || score < 1 || score > 5 || (payload?.comment !== undefined && string(payload.comment).length > 400)) return fail("Dados inválidos", 422); const session = await store.findOne("sessions", { id: feedbackId, student_id: student.id }); if (!session) return fail("Conversa não encontrada", 404); if (session.status !== "completed") return fail("Feedback disponível após a conversa", 409); const record = { id: id(), session_id: feedbackId, student_id: student.id, institution_id: student.institution_id, score, comment: payload?.comment ? string(payload.comment) : null, created_at: now() }; await store.update("feedback", { session_id: feedbackId }, { $set: record }, true); await logEvent(env, "feedback_submitted", user, student.institution_id, { score }); return json(record, 201); }
  return undefined;
}

async function professionalRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (!pathname.startsWith("/api/professionals/")) return undefined;
  const identity = await getProfessional(request, env); if (isResponse(identity)) return identity;
  const { user, professional } = identity, store = db(env);
  if (pathname === "/api/professionals/me" && request.method === "GET") return json({ professional, name: user.name, institution: await store.findOne("institutions", { id: professional.institution_id }) });
  if (pathname === "/api/professionals/me/availability" && request.method === "GET") return json(await store.findMany("availability", { professional_id: professional.id }, { sort: sortDate, limit: 500 }));
  if (pathname === "/api/professionals/me/availability" && request.method === "POST") {
    const payload = await requestBody(request), date = payload?.date, times = payload?.times;
    if (!validDate(date) || !Array.isArray(times) || times.length < 1 || times.length > 20 || times.some((time) => typeof time !== "string" || !time.trim())) return fail("Dados inválidos", 422);
    const created: Doc[] = [];
    for (const time of times) { const slot = { id: id(), professional_id: professional.id, institution_id: professional.institution_id, date, time: time.trim(), status: "open", created_at: now() }; try { await store.insert("availability", slot); created.push(slot); } catch { /* unique index preserves original duplicate behavior */ } }
    await logEvent(env, "availability_created", user, professional.institution_id, { count: created.length }); return json(created, 201);
  }
  const slotId = pathParameter(pathname, "/api/professionals/me/availability/");
  if (slotId && request.method === "DELETE") { const slot = await store.findOne("availability", { id: slotId, professional_id: professional.id }); if (!slot) return fail("Horário não encontrado", 404); if (slot.status === "reserved") return fail("Horário reservado por um estudante", 409); await store.remove("availability", { id: slotId }); return json({ ok: true }); }
  if (pathname === "/api/professionals/me/requests" && request.method === "GET") { const requests = await store.findMany("requests", { professional_id: professional.id }, { sort: sortDate, limit: 500 }); const records: Doc[] = []; for (const record of requests) records.push({ id: record.id, date: record.date, time: record.time, status: record.status, reason_code: record.reason_code, reason_note: record.reason_note, room_link: record.room_link, created_at: record.created_at, session: await store.findOne("sessions", { request_id: record.id }) }); return json(records); }
  const acceptId = pathParameter(pathname, "/api/professionals/me/requests/", "/accept");
  if (acceptId && request.method === "POST") { const record = await store.findOne("requests", { id: acceptId, professional_id: professional.id }); if (!record) return fail("Solicitação não encontrada", 404); if (await store.update("requests", { id: acceptId, professional_id: professional.id, status: "pending" }, { $set: { status: "accepted" } }) === 0) return fail("Solicitação já tratada", 409); const session = { id: id(), request_id: acceptId, student_id: record.student_id, professional_id: professional.id, institution_id: professional.institution_id, date: record.date, time: record.time, status: "scheduled", created_at: now() }; await store.insert("sessions", session); await logEvent(env, "request_accepted", user, professional.institution_id, { request_id: acceptId }); return json(session); }
  const declineId = pathParameter(pathname, "/api/professionals/me/requests/", "/decline");
  if (declineId && request.method === "POST") { const record = await store.findOne("requests", { id: declineId, professional_id: professional.id }); if (!record) return fail("Solicitação não encontrada", 404); if (await store.update("requests", { id: declineId, professional_id: professional.id, status: "pending" }, { $set: { status: "declined" } }) === 0) return fail("Solicitação já tratada", 409); await store.update("availability", { id: record.availability_id }, { $set: { status: "open" } }); await logEvent(env, "request_declined", user, professional.institution_id, { request_id: declineId }); return json({ ok: true }); }
  const roomId = pathParameter(pathname, "/api/professionals/me/requests/", "/room-link");
  if (roomId && request.method === "POST") { const payload = await requestBody(request), roomLink = string(payload?.room_link); if (roomLink.length < 8 || roomLink.length > 300 || !/^https?:\/\//.test(roomLink)) return fail("Informe um link válido (https://...)", 422); const record = await store.findOne("requests", { id: roomId, professional_id: professional.id }); if (!record) return fail("Solicitação não encontrada", 404); if (record.status !== "accepted") return fail("Só é possível definir a sala de uma conversa confirmada", 409); const session = await store.findOne("sessions", { request_id: roomId }); if (session?.status === "completed") return fail("Conversa já concluída", 409); await store.update("requests", { id: roomId }, { $set: { room_link: roomLink } }); return json({ ok: true, room_link: roomLink }); }
  if (pathname === "/api/professionals/me/sessions" && request.method === "GET") { const sessions = await store.findMany("sessions", { professional_id: professional.id }, { sort: sortDate, limit: 500 }); const records: Doc[] = []; for (const session of sessions) { const record = await store.findOne("requests", { id: session.request_id }); records.push({ ...session, reason_code: record?.reason_code, reason_note: record?.reason_note, room_link: record?.room_link, referral: await store.findOne("referrals", { session_id: session.id }) }); } return json(records); }
  const completeId = pathParameter(pathname, "/api/professionals/me/sessions/", "/complete");
  if (completeId && request.method === "POST") { const session = await store.findOne("sessions", { id: completeId, professional_id: professional.id }); if (!session) return fail("Conversa não encontrada", 404); if (session.status === "completed") return fail("Conversa já concluída", 409); await store.update("sessions", { id: completeId }, { $set: { status: "completed", completed_at: now() } }); await store.update("requests", { id: session.request_id }, { $set: { status: "completed" } }); await logEvent(env, "session_completed", user, professional.institution_id, { session_id: completeId }); return json({ ok: true }); }
  const referralId = pathParameter(pathname, "/api/professionals/me/sessions/", "/referral");
  if (referralId && request.method === "POST") { const payload = await requestBody(request), status = payload?.status; if (!oneOf(status, referralStatuses) || (payload?.note !== undefined && string(payload.note).length > 400)) return fail("Dados inválidos", 422); const session = await store.findOne("sessions", { id: referralId, professional_id: professional.id }); if (!session) return fail("Conversa não encontrada", 404); const referral = { id: id(), session_id: referralId, institution_id: professional.institution_id, status, note: payload?.note ? string(payload.note) : null, created_at: now() }; await store.update("referrals", { session_id: referralId }, { $set: referral }, true); await logEvent(env, "referral_registered", user, professional.institution_id, { status }); return json(referral, 201); }
  return undefined;
}

async function institutionMetrics(env: Env, institutionId: string) {
  const store = db(env), students = await store.findMany("students", { institution_id: institutionId }, { limit: 1000 }), professionals = await store.findMany("professionals", { institution_id: institutionId }, { limit: 200 }), requests = await store.findMany("requests", { institution_id: institutionId }, { limit: 2000 }), sessions = await store.findMany("sessions", { institution_id: institutionId }, { limit: 2000 });
  const sessionIds = sessions.map((session) => session.id), referrals = sessionIds.length ? await store.findMany("referrals", { session_id: { $in: sessionIds } }, { limit: 2000 }) : [], feedback = await store.findMany("feedback", { institution_id: institutionId }, { projection: { score: 1 }, limit: 2000 });
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString(), byMonth: Record<string, number> = {}, referralsByStatus: Record<string, number> = {};
  for (const record of requests) if (record.created_at) { const month = String(record.created_at).slice(0, 7); byMonth[month] = (byMonth[month] || 0) + 1; }
  for (const referral of referrals) referralsByStatus[String(referral.status)] = (referralsByStatus[String(referral.status)] || 0) + 1;
  const scores = feedback.map((entry) => Number(entry.score)).filter((score) => Number.isFinite(score) && score > 0), requestingStudents = new Set(requests.map((record) => record.student_id));
  const prosWithSlots = await store.distinct("availability", "professional_id", { institution_id: institutionId });
  return { students_registered: students.length, students_accessed: students.filter((student) => student.last_access).length, students_active_30d: students.filter((student) => student.last_access && String(student.last_access) >= cutoff).length, students_requested: requestingStudents.size, requests_total: requests.length, requests_pending: requests.filter((record) => record.status === "pending").length, requests_scheduled: requests.filter((record) => record.status === "accepted").length, requests_cancelled: requests.filter((record) => record.status === "cancelled").length, requests_declined: requests.filter((record) => record.status === "declined").length, sessions_completed: sessions.filter((session) => session.status === "completed").length, referrals_total: referrals.length, referrals_by_status: referralsByStatus, professionals_linked: professionals.length, professionals_accessed: professionals.filter((professional) => professional.last_access).length, professionals_with_availability: prosWithSlots.length, open_slots: await store.count("availability", { institution_id: institutionId, status: "open" }), requests_by_month: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, requests: count })), feedback_count: scores.length, feedback_average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null, has_data: Boolean(requests.length || sessions.length), data_source: "pilot" };
}

async function institutionRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (!pathname.startsWith("/api/institutions/")) return undefined;
  const identity = await getInstitution(request, env); if (isResponse(identity)) return identity;
  const { user, institution } = identity, store = db(env);
  if (pathname === "/api/institutions/me" && request.method === "GET") return json(institution);
  if (pathname === "/api/institutions/me" && request.method === "PUT") { const payload = await requestBody(request); if (!payload) return fail("Corpo JSON inválido", 422); const patch: Doc = {}; if (payload.name !== undefined) { const value = string(payload.name); if (value.length < 2 || value.length > 120) return fail("Dados inválidos", 422); patch.name = value; } if (payload.contact_email !== undefined) { const value = email(payload.contact_email); if (!value) return fail("Dados inválidos", 422); patch.contact_email = value; } if (payload.support_note !== undefined) { const value = string(payload.support_note); if (value.length > 400) return fail("Dados inválidos", 422); patch.support_note = value || null; } if (Object.keys(patch).length) await store.update("institutions", { id: institution.id }, { $set: patch }); return json(await store.findOne("institutions", { id: institution.id })); }
  if (pathname === "/api/institutions/me/students" && request.method === "GET") { const students = await store.findMany("students", { institution_id: institution.id }, { limit: 500 }), output: Doc[] = []; for (const student of students) { const account = await store.findOne("users", { id: student.user_id }); output.push({ id: student.id, name: account?.name || "—", active: account?.active !== false, last_access: student.last_access, requests: await store.count("requests", { student_id: student.id }) }); } return json(output); }
  if (pathname === "/api/institutions/me/professionals" && request.method === "GET") { const professionals = await store.findMany("professionals", { institution_id: institution.id }, { limit: 200 }), output: Doc[] = []; for (const professional of professionals) { const account = await store.findOne("users", { id: professional.user_id }); output.push({ id: professional.id, name: account?.name || "—", email: account?.email, active: account?.active !== false, link_type: professional.link_type, specialty: professional.specialty, open_slots: await store.count("availability", { professional_id: professional.id, status: "open" }), completed_sessions: await store.count("sessions", { professional_id: professional.id, status: "completed" }), invite_pending: Boolean(account?.invite_token), invite_path: account?.invite_token ? `/convite/${account.invite_token}` : null, last_access: professional.last_access }); } return json(output); }
  if (pathname === "/api/institutions/me/professionals" && request.method === "POST") { const payload = await requestBody(request), name = string(payload?.name), address = email(payload?.email), linkType = payload?.link_type === undefined ? "institution" : payload.link_type, specialty = payload?.specialty === undefined ? null : string(payload.specialty); if (name.length < 2 || name.length > 90 || !address || !oneOf(linkType, ["institution", "partner"]) || (specialty && specialty.length > 120)) return fail("Dados inválidos", 422); if (await store.findOne("users", { email: address })) return fail("Este e-mail já possui conta", 409); const invite = tokenSecret(), account = { id: id(), name, email: address, password_hash: "", role: "professional", institution_id: institution.id, active: false, invite_token: invite, invite_expires_at: isoAfter(14, "days"), created_at: now() }, professional = { id: id(), user_id: account.id, institution_id: institution.id, link_type: linkType, specialty, created_at: now(), last_access: null }; try { await store.insert("users", account); await store.insert("professionals", professional); } catch { return fail("Este e-mail já possui conta", 409); } await logEvent(env, "professional_invited", user, institution.id, { professional_id: professional.id }); return json({ id: professional.id, name, email: address, link_type: linkType, invite_path: `/convite/${invite}`, note: "O profissional define a própria senha ao abrir o convite." }, 201); }
  if (pathname === "/api/institutions/me/metrics" && request.method === "GET") return json(await institutionMetrics(env, institution.id));
  return undefined;
}

async function adminRoutes(request: Request, env: Env, pathname: string): Promise<Response | undefined> {
  if (!pathname.startsWith("/api/admin/") && pathname !== "/api/metrics/global") return undefined;
  const admin = await userWithRole(request, env, ["admin"]); if (isResponse(admin)) return admin;
  const store = db(env);
  if (pathname === "/api/admin/users" && request.method === "GET") { const users = await store.findMany("users", {}, { sort: { created_at: -1 }, limit: 500 }), institutions = await store.findMany("institutions", {}, { limit: 200 }), names = new Map(institutions.map((institution) => [institution.id, institution.name])); return json(users.map((user) => { delete user.password_hash; return { ...user, institution_name: names.get(user.institution_id) }; })); }
  const targetId = pathParameter(pathname, "/api/admin/users/", "/toggle-active");
  if (targetId && request.method === "POST") { const target = await store.findOne("users", { id: targetId }); if (!target) return fail("Usuário não encontrado", 404); if (target.role === "admin") return fail("Não é possível desativar um administrador", 403); const active = target.active === false; await store.update("users", { id: targetId }, { $set: { active } }); await logEvent(env, "user_access_toggled", admin, target.institution_id, { target: targetId, active }); return json({ id: targetId, active }); }
  if (pathname === "/api/admin/institutions" && request.method === "GET") { const institutions = await store.findMany("institutions", {}, { limit: 200 }); for (const institution of institutions) { institution.students = await store.count("students", { institution_id: institution.id }); institution.professionals = await store.count("professionals", { institution_id: institution.id }); } return json(institutions); }
  if (pathname === "/api/admin/institutions" && request.method === "POST") { const payload = await requestBody(request), name = string(payload?.name), code = string(payload?.code).toUpperCase(), contact = payload?.contact_email === undefined || payload.contact_email === null ? null : email(payload.contact_email), adminEmail = payload?.admin_email === undefined || payload.admin_email === null ? null : email(payload.admin_email), adminPassword = payload?.admin_password; if (name.length < 2 || name.length > 120 || code.length < 3 || code.length > 40 || (payload?.contact_email && !contact) || (payload?.admin_email && !adminEmail) || (adminPassword !== undefined && adminPassword !== null && !validPassword(adminPassword))) return fail("Dados inválidos", 422); if (await store.findOne("institutions", { code })) return fail("Código de instituição já utilizado", 409); if (adminEmail && await store.findOne("users", { email: adminEmail })) return fail("E-mail do gestor já possui conta", 409); const institution = { id: id(), name, code, contact_email: contact, plan: "piloto", support_note: null, created_at: now() }; await store.insert("institutions", institution); if (adminEmail && adminPassword) await store.insert("users", { id: id(), name: string(payload?.admin_name) || name, email: adminEmail, password_hash: await hashPassword(adminPassword), role: "institution", institution_id: institution.id, active: true, created_at: now() }); await logEvent(env, "institution_created", admin, institution.id); return json(institution, 201); }
  if (pathname === "/api/admin/requests" && request.method === "GET") { const records = await store.findMany("requests", {}, { projection: { reason_note: 0 }, sort: { created_at: -1 }, limit: 500 }), institutions = await store.findMany("institutions", {}, { limit: 200 }), names = new Map(institutions.map((institution) => [institution.id, institution.name])); return json(records.map((record) => ({ ...record, institution_name: names.get(record.institution_id) }))); }
  if (pathname === "/api/metrics/global" && request.method === "GET") { const institutions = await store.findMany("institutions", {}, { limit: 200 }), perInstitution = []; for (const institution of institutions) perInstitution.push({ institution: institution.name, code: institution.code, ...await institutionMetrics(env, institution.id) }); const students = await store.findMany("students", {}, { projection: { last_access: 1 }, limit: 2000 }); return json({ institutions: institutions.length, users: await store.count("users"), students_registered: students.length, students_accessed: students.filter((student) => student.last_access).length, professionals: await store.count("professionals"), requests: await store.count("requests"), sessions_completed: await store.count("sessions", { status: "completed" }), referrals: await store.count("referrals"), events: await store.count("events"), pending_invites: await store.count("users", { invite_token: { $exists: true } }), per_institution: perInstitution }); }
  return undefined;
}

export async function apiRoute(request: Request, env: Env, pathname: string): Promise<Response> {
  if (pathname === "/api" || pathname === "/api/") return json({ service: "acolhe-mvp", status: "ok", runtime: "cloudflare-worker" });
  for (const route of [authRoutes, studentRoutes, professionalRoutes, institutionRoutes, adminRoutes]) { const response = await route(request, env, pathname); if (response) return response; }
  return fail("Não encontrado", 404);
}
