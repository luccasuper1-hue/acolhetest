import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const professionalUserId = process.env.PROFESSIONAL_USER_ID;
const institutionId = process.env.TARGET_INSTITUTION_ID;
if (!uri || !professionalUserId || !institutionId) throw new Error("Defina MONGODB_URI, PROFESSIONAL_USER_ID e TARGET_INSTITUTION_ID");
if (process.env.CONFIRM_MIGRATION !== "yes") throw new Error("Defina CONFIRM_MIGRATION=yes para executar uma migração controlada");

const client = new MongoClient(uri);
await client.connect();
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    const db = client.db();
    const professional = await db.collection("professionals").findOne({ user_id: professionalUserId }, { session });
    if (!professional) throw new Error("Profissional não encontrado");
    await db.collection("users").updateOne({ id: professionalUserId }, { $set: { institution_id: institutionId } }, { session });
    await db.collection("professionals").updateOne({ id: professional.id }, { $set: { institution_id: institutionId } }, { session });
    for (const collection of ["availability", "requests", "appointment_requests", "sessions"]) {
      await db.collection(collection).updateMany({ professional_id: professional.id }, { $set: { institution_id: institutionId } }, { session });
    }
    await db.collection("events").insertOne({ id: crypto.randomUUID(), type: "data_repair", user_id: null, role: "system", institution_id: institutionId, meta: { migration: "repair-institution-link-v1", professional_id: professional.id }, created_at: new Date().toISOString() }, { session });
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  console.log("Migração concluída com sucesso.");
} finally {
  await session.endSession();
  await client.close();
}
