import { MongoClient } from "../cloudflare-worker/node_modules/mongodb/lib/index.js";
import { hash } from "../cloudflare-worker/node_modules/bcryptjs/index.js";

const uri = process.env.MONGO_URI;
const prefix = process.env.LOAD_PREFIX;
const password = process.env.LOAD_PASSWORD;
const studentsCount = Number(process.env.STUDENT_USERS || 30);
if (!uri || !prefix || !password) throw new Error("MONGO_URI, LOAD_PREFIX e LOAD_PASSWORD são obrigatórios.");
const MONGO_TIMEOUT_MS = 15_000;
const client = new MongoClient(uri, { maxPoolSize: 4, serverSelectionTimeoutMS: MONGO_TIMEOUT_MS, connectTimeoutMS: MONGO_TIMEOUT_MS, socketTimeoutMS: MONGO_TIMEOUT_MS });
await client.connect();
const database = client.db(process.env.DB_NAME || "acolhe_staging");
const collections = ["users", "students", "professionals", "institutions", "availability", "requests", "appointment_requests", "sessions", "notifications", "referrals", "feedback"];
const tagged = { load_tag: prefix };
for (const name of collections) await database.collection(name).deleteMany(tagged);
// Clean records created by the application during a previous E2E attempt.
// Those records intentionally do not carry the fixture tag, so scope them by
// the dedicated test professional/request namespace instead of broad staging data.
const e2eProfessionalId = `${prefix}-professional-profile`;
await database.collection("availability").deleteMany({ professional_id: e2eProfessionalId, source: "direct_request" });
await database.collection("sessions").deleteMany({ appointment_request_id: { $regex: `^${prefix}-appointment-` } });
await database.collection("session_messages").deleteMany({ session_id: { $regex: `^${prefix}-` } });
await database.collection("referrals").deleteMany({ session_id: { $regex: `^${prefix}-` } });
await database.collection("feedback").deleteMany({ session_id: { $regex: `^${prefix}-` } });
await database.collection("certificates").deleteMany({ professional_id: e2eProfessionalId });
if (process.env.CLEANUP === "1") { await client.close(); console.log(JSON.stringify({ prefix, cleaned: true })); process.exit(0); }
const now = new Date().toISOString();
const institutionId = `${prefix}-institution`;
const professionalId = `${prefix}-professional-profile`;
const institutionUserId = `${prefix}-institution-user`;
const professionalUserId = `${prefix}-professional-user`;
const adminUserId = `${prefix}-admin-user`;
const passwordHash = await hash(password, 10);
await database.collection("institutions").insertOne({ id: institutionId, name: "Carga Staging", code: `${prefix}-CODE`, active: true, created_at: now, ...tagged });
const users = [
  { id: institutionUserId, name: "Carga Instituição", email: `${prefix}-institution@example.test`, password_hash: passwordHash, role: "institution", institution_id: institutionId, active: true, session_version: 0, created_at: now, ...tagged },
  { id: professionalUserId, name: "Carga Profissional", email: `${prefix}-professional@example.test`, password_hash: passwordHash, role: "professional", institution_id: institutionId, active: true, session_version: 0, created_at: now, ...tagged },
  { id: adminUserId, name: "Carga Admin", email: `${prefix}-admin@example.test`, password_hash: passwordHash, role: "admin", active: true, session_version: 0, created_at: now, ...tagged },
];
const students = [], studentProfiles = [], requests = [], appointmentRequests = [], sessions = [], notifications = [], availability = [];
for (let index = 0; index < studentsCount; index += 1) {
  const userId = `${prefix}-student-user-${index}`;
  const studentId = `${prefix}-student-profile-${index}`;
  const requestId = `${prefix}-request-${index}`;
  const appointmentId = `${prefix}-appointment-${index}`;
  const requestSessionId = `${prefix}-request-session-${index}`;
  const appointmentSessionId = `${prefix}-appointment-session-${index}`;
  users.push({ id: userId, name: `Carga Estudante ${index}`, email: `${prefix}-student-${index}@example.test`, password_hash: passwordHash, role: "student", institution_id: institutionId, active: true, session_version: 0, consent_role: "student", consent_version: "pilot-v1", consent_accepted_at: now, age_band: "adult", created_at: now, ...tagged });
  studentProfiles.push({ id: studentId, user_id: userId, institution_id: institutionId, last_access: now, created_at: now, ...tagged });
  requests.push({ id: requestId, student_id: studentId, professional_id: professionalId, institution_id: institutionId, date: "2026-12-15", time: "09:00", status: "accepted", meeting_mode: "online", reason_code: "anxiety", created_at: now, responded_at: now, load_tag: prefix });
  appointmentRequests.push({ id: appointmentId, student_id: studentId, professional_id: professionalId, institution_id: institutionId, status: "pending", meeting_mode: "online", reason_code: "other", created_at: now, load_tag: prefix });
  sessions.push({ id: requestSessionId, request_id: requestId, student_id: studentId, professional_id: professionalId, institution_id: institutionId, date: "2026-12-15", time: "09:00", duration_minutes: 30, status: "completed", created_at: now, ...tagged });
  // The authenticated E2E flow must confirm the pending appointment itself.
  // Keep synthetic appointment sessions for load tests, but omit them in E2E
  // mode so the unique appointment_request_id index can prove the real write.
  if (process.env.E2E_MODE !== "1") sessions.push({ id: appointmentSessionId, appointment_request_id: appointmentId, student_id: studentId, professional_id: professionalId, institution_id: institutionId, date: "2026-12-16", time: "10:00", duration_minutes: 30, status: "scheduled", created_at: now, ...tagged });
  for (let note = 0; note < 3; note += 1) notifications.push({ id: `${prefix}-notification-${index}-${note}`, recipient_user_id: userId, institution_id: institutionId, type: "load_test", title: "Aviso de teste", body: "Registro temporário de carga", read: false, created_at: now, ...tagged });
}
for (let index = 0; index < 120; index += 1) availability.push({ id: `${prefix}-availability-${index}`, professional_id: professionalId, institution_id: institutionId, date: "2026-12-20", time: `${String(8 + Math.floor(index / 12)).padStart(2, "0")}:${String((index % 12) * 5).padStart(2, "0")}`, duration_minutes: 30, status: "open", mode: "online", created_at: now, ...tagged });
await database.collection("users").insertMany(users);
await database.collection("students").insertMany(studentProfiles);
await database.collection("professionals").insertOne({ id: professionalId, user_id: professionalUserId, institution_id: institutionId, link_type: "institution", specialty: "Orientação", created_at: now, ...tagged });
await database.collection("requests").insertMany(requests);
await database.collection("appointment_requests").insertMany(appointmentRequests);
await database.collection("sessions").insertMany(sessions);
await database.collection("notifications").insertMany(notifications);
await database.collection("availability").insertMany(availability);
console.log(JSON.stringify({ prefix, students: studentsCount, institutionId }));
await client.close();
