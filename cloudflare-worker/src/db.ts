import { MongoClient, type Db, type Document, type Filter, type Sort } from "mongodb";
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";

// Documents are schemaless in the existing Atlas collections. Route-level
// validation narrows external input before it reaches this boundary.
export type RecordDoc = Record<string, any>;

/** Keeps Atlas' TCP connection alive in one Durable Object. */
export class MongoGateway extends DurableObject<Env> {
  private client: MongoClient;
  private database?: Db;
  private connectPromise?: Promise<Db>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.client = new MongoClient(env.MONGO_URL, {
      // A Durable Object can serve overlapping requests while awaiting I/O.
      // A single connection serialized the whole authenticated flow; keep a
      // small bounded pool so concurrent users can make progress without
      // opening an unbounded number of Atlas connections.
      maxPoolSize: 8,
      minPoolSize: 1,
      maxIdleTimeMS: 20_000,
      serverSelectionTimeoutMS: 5_000,
      waitQueueTimeoutMS: 8_000,
    });
  }

  private async db(): Promise<Db> {
    if (!this.database) {
      this.connectPromise ??= this.client.connect().then(() => {
        this.database = this.client.db(this.env.DB_NAME);
        return this.database;
      });
      try {
        return await this.connectPromise;
      } finally {
        if (this.database) this.connectPromise = undefined;
      }
    }
    return this.database;
  }

  private collection(name: string) {
    return this.db().then((database) => database.collection<RecordDoc>(name));
  }

  async findOne(collection: string, filter: Filter<RecordDoc>, projection?: Record<string, 0 | 1>): Promise<RecordDoc | null> {
    return (await (await this.collection(collection)).findOne(filter, { projection: { _id: 0, ...projection } })) as RecordDoc | null;
  }

  async findMany(collection: string, filter: Filter<RecordDoc>, options: { projection?: Record<string, 0 | 1>; sort?: Sort; limit?: number } = {}): Promise<RecordDoc[]> {
    const cursor = (await this.collection(collection)).find(filter, { projection: { _id: 0, ...options.projection }, sort: options.sort, limit: options.limit });
    return (await cursor.toArray()) as RecordDoc[];
  }

  async insert(collection: string, value: RecordDoc): Promise<void> {
    await (await this.collection(collection)).insertOne(value);
  }

  async update(collection: string, filter: Filter<RecordDoc>, update: Document, upsert = false): Promise<number> {
    return (await (await this.collection(collection)).updateOne(filter, update, { upsert })).modifiedCount;
  }

  async remove(collection: string, filter: Filter<RecordDoc>, many = false): Promise<number> {
    const result = many ? await (await this.collection(collection)).deleteMany(filter) : await (await this.collection(collection)).deleteOne(filter);
    return result.deletedCount;
  }

  async count(collection: string, filter: Filter<RecordDoc> = {}): Promise<number> {
    return (await this.collection(collection)).countDocuments(filter);
  }

  async distinct(collection: string, field: string, filter: Filter<RecordDoc> = {}): Promise<string[]> {
    return (await (await this.collection(collection)).distinct(field, filter)).map(String);
  }

  async findOneAndUpdate(collection: string, filter: Filter<RecordDoc>, update: Document, projection?: Record<string, 0 | 1>): Promise<RecordDoc | null> {
    return (await (await this.collection(collection)).findOneAndUpdate(filter, update, {
      projection: { _id: 0, ...projection }, returnDocument: "before",
    })) as RecordDoc | null;
  }
}

export type Mongo = Pick<MongoGateway, "findOne" | "findMany" | "insert" | "update" | "remove" | "count" | "distinct" | "findOneAndUpdate">;

export function gateway(env: Env): Mongo {
  return env.MONGO_GATEWAY.get(env.MONGO_GATEWAY.idFromName("acolhe-mongodb")) as unknown as Mongo;
}
