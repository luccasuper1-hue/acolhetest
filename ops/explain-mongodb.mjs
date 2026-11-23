import { MongoClient } from "mongodb";

// Direct Atlas diagnostics only. Never run this through the Worker/DO and
// never print the URI, filter values, document bodies, tokens, or identifiers.
const uri = process.env.MONGO_URL;
const databaseName = process.env.DB_NAME;
if (!uri || !databaseName) throw new Error("MONGO_URL e DB_NAME são obrigatórios");
const institutionId = process.env.INSTITUTION_ID || null;
const professionalId = process.env.PROFESSIONAL_ID || null;
const limit = Math.min(100, Math.max(1, Number(process.env.EXPLAIN_LIMIT || 20) || 20));
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000, maxPoolSize: 1 });

const summarize = (collection, label, plan, stats) => {
  const winning = stats?.queryPlanner?.winningPlan;
  const stages = JSON.stringify(winning || "");
  console.log(JSON.stringify({
    collection,
    label,
    stage: stages.includes("IXSCAN") ? "IXSCAN" : stages.includes("COLLSCAN") ? "COLLSCAN" : "OTHER",
    totalKeysExamined: stats?.executionStats?.totalKeysExamined ?? null,
    totalDocsExamined: stats?.executionStats?.totalDocsExamined ?? null,
    nReturned: stats?.executionStats?.nReturned ?? null,
    executionTimeMillis: stats?.executionStats?.executionTimeMillis ?? null,
    plan,
  }));
};

const findPlan = async (db, collection, label, filter, sort = { created_at: -1, id: -1 }) => {
  const stats = await db.collection(collection).find(filter, { projection: { _id: 0 }, sort, limit }).explain("executionStats");
  summarize(collection, label, { kind: "find", sort, limit }, stats);
};

const aggregatePlan = async (db, collection, label, pipeline) => {
  const stats = await db.collection(collection).aggregate(pipeline, { maxTimeMS: 3_000, hint: undefined }).explain("executionStats");
  summarize(collection, label, { kind: "aggregate", stages: pipeline.length }, stats);
};

try {
  await client.connect();
  const db = client.db(databaseName);
  const institutionFilter = institutionId ? { institution_id: institutionId } : { institution_id: { $exists: true } };
  const professionalFilter = professionalId ? { professional_id: professionalId } : { professional_id: { $exists: true } };
  await findPlan(db, "requests", "requests-by-institution", institutionFilter);
  await findPlan(db, "appointment_requests", "direct-requests-by-institution", institutionFilter);
  await findPlan(db, "sessions", "sessions-by-professional", professionalFilter, { date: 1, time: 1, id: -1 });
  await findPlan(db, "availability", "availability-by-professional", { ...professionalFilter, status: "open" }, { date: 1, time: 1, id: -1 });
  await findPlan(db, "notifications", "notifications-by-recipient", { recipient_user_id: process.env.USER_ID || { $exists: true } });
  await findPlan(db, "events", "events-by-institution", institutionFilter);
  await findPlan(db, "feedback", "feedback-by-institution", institutionFilter);
  await findPlan(db, "referrals", "referrals-by-institution", institutionFilter);
  await aggregatePlan(db, "requests", "institution-request-aggregate", [{ $match: institutionFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  await aggregatePlan(db, "appointment_requests", "institution-direct-request-aggregate", [{ $match: institutionFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  await aggregatePlan(db, "users", "admin-users-by-role", [{ $match: { role: { $in: ["student", "professional", "institution", "admin"] } } }, { $group: { _id: "$role", count: { $sum: 1 } } }]);
} finally {
  await client.close();
}
