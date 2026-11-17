import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URL;
const databaseName = process.env.DB_NAME;
if (!uri || !databaseName) {
  throw new Error("MONGO_URL e DB_NAME são obrigatórios. Use somente um Atlas de desenvolvimento.");
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(databaseName);
  // The original request_id index was not sparse, so appointment sessions
  // without a legacy request_id collided on MongoDB's single null key.
  await db.collection("sessions").dropIndex("request_id_1").catch(() => {});
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ institution_id: 1, role: 1, active: 1 }),
    db.collection("institutions").createIndex({ code: 1 }, { unique: true }),
    db.collection("students").createIndex({ institution_id: 1, user_id: 1 }),
    db.collection("professionals").createIndex({ institution_id: 1, user_id: 1 }),
    db.collection("sessions").createIndex({ student_id: 1 }),
    db.collection("appointment_requests").createIndex({ student_id: 1 }),
    db.collection("appointment_requests").createIndex({ professional_id: 1 }),
    db.collection("availability_interests").createIndex({ student_id: 1 }),
    db.collection("availability_interests").createIndex({ professional_id: 1 }),
    db.collection("events").createIndex({ user_id: 1 }),
    db.collection("password_reset_tokens").createIndex({ user_id: 1 }),
    db.collection("availability").createIndex({ professional_id: 1, date: 1, time: 1 }, { unique: true }),
    db.collection("availability").createIndex({ institution_id: 1, status: 1, date: 1, time: 1 }),
    db.collection("requests").createIndex({ student_id: 1, created_at: -1 }),
    db.collection("requests").createIndex({ professional_id: 1, status: 1, created_at: -1 }),
    db.collection("requests").createIndex({ institution_id: 1, created_at: -1 }),
    db.collection("sessions").createIndex({ request_id: 1 }, { unique: true, sparse: true }),
    db.collection("sessions").createIndex({ appointment_request_id: 1 }, { unique: true, sparse: true }),
    db.collection("sessions").createIndex({ professional_id: 1, status: 1, date: 1, time: 1 }),
    db.collection("sessions").createIndex({ institution_id: 1, status: 1 }),
    db.collection("session_messages").createIndex({ session_id: 1, created_at: 1 }),
    db.collection("session_messages").createIndex({ id: 1, session_id: 1 }),
    db.collection("referrals").createIndex({ session_id: 1 }, { unique: true }),
    db.collection("feedback").createIndex({ session_id: 1 }, { unique: true }),
    db.collection("notifications").createIndex({ recipient_user_id: 1, created_at: -1, id: -1 }),
    db.collection("notifications").createIndex({ recipient_user_id: 1, id: 1 }),
    db.collection("notifications").createIndex({ recipient_user_id: 1, read: 1 }),
    db.collection("login_attempts").createIndex({ identifier: 1 }, { unique: true }),
    db.collection("password_reset_tokens").createIndex({ token: 1 }, { unique: true }),
  ]);
  console.log("Índices do Acolhe confirmados.");
} finally {
  await client.close();
}
