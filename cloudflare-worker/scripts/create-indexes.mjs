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
  const duplicateCodes = await db.collection("certificates").aggregate([
    { $match: { code: { $exists: true, $ne: null } } },
    { $group: { _id: "$code", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 20 },
  ]).toArray();
  if (duplicateCodes.length) {
    throw new Error(`Existem códigos de certificado duplicados; resolva antes de criar o índice: ${duplicateCodes.map(item => String(item._id)).join(", ")}`);
  }
  // The original request_id index was not sparse, so appointment sessions
  // without a legacy request_id collided on MongoDB's single null key.
  await db.collection("sessions").dropIndex("request_id_1").catch(() => {});
  const analytics = db.collection("analytics_daily");
  // Atlas does not create empty collections. Treat a missing analytics
  // namespace as an empty index set so first-time setup remains idempotent.
  const analyticsIndexes = await analytics.listIndexes().toArray().catch((error) => {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") return [];
    throw error;
  });
  for (const index of analyticsIndexes) {
    if (JSON.stringify(index.key) === JSON.stringify({ created_at: 1 }) && index.expireAfterSeconds !== 366 * 24 * 60 * 60) {
      await analytics.dropIndex(index.name);
    }
  }
  const analyticsTtlIndex = (await analytics.listIndexes().toArray().catch((error) => {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") return [];
    throw error;
  })).find(index => JSON.stringify(index.key) === JSON.stringify({ created_at: 1 }) && index.expireAfterSeconds === 366 * 24 * 60 * 60);
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ institution_id: 1, role: 1, active: 1 }),
    db.collection("institutions").createIndex({ code: 1 }, { unique: true }),
    db.collection("students").createIndex({ institution_id: 1, user_id: 1 }),
    db.collection("professionals").createIndex({ institution_id: 1, user_id: 1 }),
    db.collection("sessions").createIndex({ student_id: 1 }),
    db.collection("appointment_requests").createIndex({ student_id: 1 }),
    db.collection("appointment_requests").createIndex({ professional_id: 1 }),
    db.collection("appointment_requests").createIndex({ institution_id: 1, status: 1, created_at: -1 }),
    db.collection("appointment_requests").createIndex({ institution_id: 1, student_id: 1, created_at: -1 }),
    db.collection("availability_interests").createIndex({ student_id: 1 }),
    db.collection("availability_interests").createIndex({ professional_id: 1 }),
    db.collection("events").createIndex({ user_id: 1 }),
    db.collection("events").createIndex({ institution_id: 1, created_at: -1 }),
    db.collection("events").createIndex({ created_at: 1 }, { name: "technical_email_events_retention", expireAfterSeconds: 180 * 24 * 60 * 60, partialFilterExpression: { type: { $in: ["email_delivery_retry_scheduled", "email_delivery_failed"] } } }),
    analyticsTtlIndex ? Promise.resolve(analyticsTtlIndex.name) : analytics.createIndex({ created_at: 1 }, { name: "analytics_daily_created_at_ttl", expireAfterSeconds: 366 * 24 * 60 * 60 }),
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
    db.collection("certificates").createIndex({ code: 1 }, { unique: true, sparse: true }),
    db.collection("certificates").createIndex({ institution_id: 1, status: 1, issued_at: -1 }),
    db.collection("certificates").createIndex({ professional_id: 1, status: 1, issued_at: -1 }),
    db.collection("session_messages").createIndex({ session_id: 1, created_at: 1 }),
    db.collection("session_messages").createIndex({ id: 1, session_id: 1 }),
    db.collection("referrals").createIndex({ session_id: 1 }, { unique: true }),
    db.collection("feedback").createIndex({ session_id: 1 }, { unique: true }),
    db.collection("feedback").createIndex({ institution_id: 1, created_at: -1 }),
    db.collection("notifications").createIndex({ recipient_user_id: 1, created_at: -1, id: -1 }),
    db.collection("notifications").createIndex({ recipient_user_id: 1, id: 1 }),
    db.collection("notifications").createIndex({ recipient_user_id: 1, read: 1 }),
    db.collection("notifications").createIndex({ "email_delivery.status": 1, "email_delivery.next_attempt_at": 1, "email_delivery.claimed_at": 1 }, { name: "notifications_email_delivery_retry" }),
    db.collection("login_attempts").createIndex({ identifier: 1 }, { unique: true }),
    db.collection("password_reset_tokens").createIndex({ token: 1 }, { unique: true }),
  ]);
  console.log("Índices do Acolhe confirmados.");
} finally {
  await client.close();
}
