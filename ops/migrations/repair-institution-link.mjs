import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
const professionalUserId = process.env.PROFESSIONAL_USER_ID;
const institutionId = process.env.TARGET_INSTITUTION_ID;
const apply = process.env.APPLY_MIGRATION === "yes";
if (!uri || !databaseName || !professionalUserId || !institutionId) throw new Error("Defina MONGODB_URI, MONGODB_DB, PROFESSIONAL_USER_ID e TARGET_INSTITUTION_ID");
if (databaseName.match(/[\\/\s]/)) throw new Error("MONGODB_DB inválido");
if (institutionId.match(/[\\/\s]/)) throw new Error("TARGET_INSTITUTION_ID inválido");
if (apply && process.env.CONFIRM_MIGRATION !== "yes") throw new Error("Para aplicar, defina CONFIRM_MIGRATION=yes e APPLY_MIGRATION=yes");

const client = new MongoClient(uri);
await client.connect();
const session = client.startSession();
try {
  const db = client.db(databaseName);
  const professional = await db.collection("professionals").findOne({ user_id: professionalUserId }, { projection: { _id: 0, id: 1, institution_id: 1 } });
  if (!professional) throw new Error("Profissional não encontrado");
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", professional_id: professional.id, current_institution_id: professional.institution_id || null, target_institution_id: institutionId }, null, 2));
  } else {
    await session.withTransaction(async () => {
      await db.collection("users").updateOne({ id: professionalUserId }, { $set: { institution_id: institutionId } }, { session });
      await db.collection("professionals").updateOne({ id: professional.id }, { $set: { institution_id: institutionId } }, { session });
      for (const collection of ["availability", "requests", "appointment_requests", "sessions"]) {
        await db.collection(collection).updateMany({ professional_id: professional.id }, { $set: { institution_id: institutionId } }, { session });
      }
      await db.collection("events").insertOne({ id: crypto.randomUUID(), type: "data_repair", user_id: null, role: "system", institution_id: institutionId, meta: { migration: "repair-institution-link-v1", professional_id: professional.id }, created_at: new Date().toISOString() }, { session });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    console.log("Migração aplicada com sucesso.");
  }
} finally {
  await session.endSession();
  await client.close();
}
