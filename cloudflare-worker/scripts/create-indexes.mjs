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
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("availability").createIndex({ professional_id: 1, date: 1, time: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ request_id: 1 }, { unique: true }),
    db.collection("login_attempts").createIndex({ identifier: 1 }, { unique: true }),
    db.collection("password_reset_tokens").createIndex({ token: 1 }, { unique: true }),
  ]);
  console.log("Índices do Acolhe confirmados.");
} finally {
  await client.close();
}
