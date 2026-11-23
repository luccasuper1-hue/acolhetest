import { createRequire } from "node:module";

// Resolve the Worker dependency even though this controlled migration lives
// outside cloudflare-worker/ and is invoked through its npm scripts.
const { MongoClient } = createRequire(new URL("../../cloudflare-worker/package.json", import.meta.url))("mongodb");

// Safe by default: without APPLY_MIGRATION=yes this only reports what would
// change. Run it from a controlled environment with a recent backup.
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
const apply = process.env.APPLY_MIGRATION === "yes";
if (!uri) throw new Error("Defina MONGODB_URI");
if (!databaseName) throw new Error("Defina MONGODB_DB");
if (apply && process.env.CONFIRM_MIGRATION !== "yes") {
  throw new Error("Para aplicar, defina CONFIRM_MIGRATION=yes e APPLY_MIGRATION=yes");
}

const client = new MongoClient(uri);
await client.connect();
const session = client.startSession();
try {
  const database = client.db(databaseName);
  const missingInstitution = { $or: [{ institution_id: { $exists: false } }, { institution_id: null }, { institution_id: "" }] };
  const allCertificates = await database.collection("certificates")
    .find({}, { projection: { _id: 0, id: 1, professional_id: 1, institution_id: 1 } })
    .toArray();
  const professionalIds = [...new Set(allCertificates.map((certificate) => certificate.professional_id).filter(Boolean).map(String))];
  const professionals = await database.collection("professionals")
    .find({ id: { $in: professionalIds } }, { projection: { _id: 0, id: 1, institution_id: 1 } })
    .toArray();
  const institutionByProfessional = new Map(professionals.map((professional) => [String(professional.id), professional.institution_id]));
  const orphaned = allCertificates.filter((certificate) => !certificate.professional_id || !institutionByProfessional.has(String(certificate.professional_id)));
  const certificates = allCertificates.filter((certificate) => certificate.institution_id === undefined || certificate.institution_id === null || certificate.institution_id === "");
  const mismatched = allCertificates.filter((certificate) => {
    const professionalInstitution = institutionByProfessional.get(String(certificate.professional_id));
    // A certificate with an institution link is not trustworthy when the
    // professional no longer has a matching link (including a missing one).
    return certificate.institution_id && String(certificate.institution_id) !== String(professionalInstitution || "");
  });
  const repairs = certificates
    .map((certificate) => ({ certificate, institutionId: institutionByProfessional.get(String(certificate.professional_id)) }))
    .filter((item) => item.institutionId);
  const unresolvedCertificateIds = certificates
    .filter((certificate) => !institutionByProfessional.get(String(certificate.professional_id)))
    .slice(0, 25)
    .map((certificate) => certificate.id);
  const unresolved = certificates.length - repairs.length;
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", status: unresolved || mismatched.length || orphaned.length ? "review_required" : "clean", candidates: certificates.length, repairs: repairs.length, unresolved, unresolved_certificate_ids: unresolvedCertificateIds, mismatched: mismatched.length, mismatched_certificate_ids: mismatched.slice(0, 25).map((certificate) => certificate.id), orphaned: orphaned.length, orphaned_certificate_ids: orphaned.slice(0, 25).map((certificate) => certificate.id) }, null, 2));
  if (apply && repairs.length) {
    let appliedRepairs = 0;
    await session.withTransaction(async () => {
      for (const { certificate } of repairs) {
        const currentProfessional = await database.collection("professionals").findOne({ id: String(certificate.professional_id) }, { projection: { _id: 0, institution_id: 1 }, session });
        const institutionId = currentProfessional?.institution_id;
        if (!institutionId) continue;
        const changed = await database.collection("certificates").updateOne(
          { id: certificate.id, ...missingInstitution },
          { $set: { institution_id: institutionId } },
          { session },
        );
        if (changed.modifiedCount === 1) {
          appliedRepairs += 1;
          await database.collection("events").insertOne({
            id: crypto.randomUUID(),
            type: "data_repair",
            user_id: null,
            role: "system",
            institution_id: institutionId,
            meta: { migration: "certificate-institution-v1", certificate_id: certificate.id },
            created_at: new Date().toISOString(),
          }, { session });
        }
      }
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    console.log(`Migração aplicada: ${appliedRepairs} certificado(s) atualizado(s).`);
  }
} finally {
  await session.endSession();
  await client.close();
}
