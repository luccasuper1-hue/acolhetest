import { MongoClient } from "../cloudflare-worker/node_modules/mongodb/lib/index.js";

const base = (process.env.BASE_URL || "https://acolhetest-staging.luccasuper1.workers.dev").replace(/\/$/, "");
const prefix = process.env.LOAD_PREFIX;
const password = process.env.LOAD_PASSWORD;
const uri = process.env.MONGO_URI;
if (!prefix || !password || !uri) throw new Error("BASE_URL, LOAD_PREFIX, LOAD_PASSWORD e MONGO_URI são obrigatórios.");

const accounts = {
  student: `${prefix}-student-0@example.test`,
  professional: `${prefix}-professional@example.test`,
};

async function login(email) {
  const response = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const cookie = (response.headers.getSetCookie?.() || []).map((value) => value.split(";", 1)[0]).join("; ");
  if (!response.ok || !cookie) throw new Error(`login falhou (${response.status})`);
  return cookie;
}

async function call(cookie, path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, { method, headers: { cookie, ...(method !== "GET" ? { origin: base, "content-type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${payload?.detail || ""}`.trim());
  return payload;
}

async function callWithBoundedRetry(cookie, path, method, body, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await call(cookie, path, method, body); }
    catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }
  throw lastError;
}

const studentCookie = await login(accounts.student);
const professionalCookie = await login(accounts.professional);
const professionalId = `${prefix}-professional-profile`;
const studentDashboard = await call(studentCookie, "/api/students/me/dashboard");
const pending = (studentDashboard.appointment_requests || []).find((record) => record.status === "pending");
if (!pending) throw new Error("fixture sem pedido direto pendente");
const requestId = pending.id;
const proposed = await call(professionalCookie, `/api/professionals/me/appointment-requests/${requestId}/propose`, "POST", { date: "2026-12-22", time: "09:00" });
const session = await call(studentCookie, `/api/students/me/appointment-requests/${requestId}/confirm`, "POST");
await call(studentCookie, `/api/students/me/sessions/${session.id}/messages`, "POST", { body: "Mensagem E2E" });
await call(professionalCookie, `/api/professionals/me/sessions/${session.id}/room-link`, "POST", { room_link: "https://example.test/e2e-room" });

const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, socketTimeoutMS: 15000 });
await client.connect();
const db = client.db(process.env.DB_NAME || "acolhe_staging");
// The session is created by the Worker and therefore has no fixture tag.
// Scope the update by its generated appointment request key.
await db.collection("sessions").updateOne({ id: session.id, appointment_request_id: requestId }, { $set: { date: "2026-01-01", time: "09:00" } });
await client.close();

await call(professionalCookie, `/api/professionals/me/sessions/${session.id}/complete`, "POST");
// Completion fans out panel refreshes asynchronously. Allow that short
// consistency window to settle, then retry only transient failures.
await new Promise((resolve) => setTimeout(resolve, 750));
await callWithBoundedRetry(professionalCookie, `/api/professionals/me/sessions/${session.id}/referral`, "POST", { status: "orientacao", note: "E2E operacional" });
await callWithBoundedRetry(studentCookie, `/api/students/me/sessions/${session.id}/feedback`, "POST", { score: 5, comment: "E2E" });
const certificate = await callWithBoundedRetry(professionalCookie, "/api/professionals/me/certificate", "POST");
const validation = await fetch(`${base}/api/certificates/${certificate.certificate.code}`);
if (!validation.ok) throw new Error(`certificado não validou (${validation.status})`);
console.log(JSON.stringify({ base, prefix, stages: ["cadastro_fixture", "pedido", "proposta", "confirmação", "mensagem", "link_sala", "encerramento", "encaminhamento", "feedback", "certificado"], request_id: requestId, session_id: session.id, certificate_code: certificate.certificate.code, result: "passed" }));
