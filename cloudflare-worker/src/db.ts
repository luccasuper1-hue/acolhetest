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
    this.client = this.createClient(env);
  }

  private createClient(env: Env) {
    // Keep the pool conservative in a Durable Object. In particular, avoid a
    // minimum pool that can leave a hibernated object with stale Atlas sockets.
    return new MongoClient(env.MONGO_URL, {
      maxPoolSize: 8,
      serverSelectionTimeoutMS: 5_000,
      waitQueueTimeoutMS: 15_000,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/realtime/broadcast" && request.method === "POST") {
      const payload = await request.json().catch(() => null) as { sessionId?: string; userId?: string; userIds?: string[]; event?: unknown } | null;
      if (payload?.event) this.broadcast(payload);
      return new Response(null, { status: 204 });
    }
    if (url.pathname !== "/realtime/socket" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Not found", { status: 404 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const metadata = { sessionId: request.headers.get("x-realtime-session") || undefined, userId: request.headers.get("x-realtime-user") || undefined, role: request.headers.get("x-realtime-role") || undefined };
    this.ctx.acceptWebSocket(server, [metadata.sessionId ? `session:${metadata.sessionId}` : "user"]);
    server.serializeAttachment(metadata);
    if (metadata.sessionId && metadata.userId) this.broadcast({ sessionId: metadata.sessionId, event: { type: "presence", userId: metadata.userId, role: metadata.role, online: true } });
    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcast(payload: { sessionId?: string; userId?: string; userIds?: string[]; event?: unknown }) {
    const message = JSON.stringify(payload.event);
    const recipients = new Set((payload.userIds || []).filter(Boolean));
    if (payload.userId) recipients.add(payload.userId);
    for (const socket of this.ctx.getWebSockets()) {
      const metadata = (socket.deserializeAttachment() as { sessionId?: string; userId?: string } | null) || {};
      const matchesSession = payload.sessionId && metadata.sessionId === payload.sessionId;
      const matchesUser = metadata.userId && recipients.has(metadata.userId);
      if (!matchesSession && !matchesUser) continue;
      try { socket.send(message); } catch { socket.close(1011, "broadcast failed"); }
    }
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    let payload: { type?: string; active?: boolean; messageId?: string } | null = null;
    try { payload = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { return; }
    const metadata = (socket.deserializeAttachment() as { sessionId?: string; userId?: string; role?: string } | null) || {};
    if (!metadata.sessionId || !metadata.userId || !payload?.type) return;
    if (payload.type === "typing") this.broadcast({ sessionId: metadata.sessionId, event: { type: "typing", userId: metadata.userId, role: metadata.role, active: Boolean(payload.active) } });
    if (payload.type === "read" && payload.messageId) {
      const readAt = new Date().toISOString();
      let persisted = false;
      try {
        await (await this.collection("session_messages")).updateOne({ id: payload.messageId, session_id: metadata.sessionId, sender_user_id: { $ne: metadata.userId } }, { $set: { read_at: readAt, read_by: metadata.userId } });
        persisted = true;
      } catch (error) {
        console.error("Chat read receipt persistence failed", error);
      }
      if (persisted) this.broadcast({ sessionId: metadata.sessionId, event: { type: "message_read", userId: metadata.userId, messageId: payload.messageId, readAt } });
    }
  }
  webSocketClose(socket: WebSocket) {
    const metadata = (socket.deserializeAttachment() as { sessionId?: string; userId?: string; role?: string } | null) || {};
    if (metadata.sessionId && metadata.userId) this.broadcast({ sessionId: metadata.sessionId, event: { type: "presence", userId: metadata.userId, role: metadata.role, online: false } });
  }
  webSocketError() { /* a reconnecting client will establish a fresh socket */ }

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
    // Durable Objects can hibernate while Atlas closes an idle connection.
    // Ping the cached handle and transparently rebuild it before serving the
    // query instead of surfacing a generic 500 from the route.
    try {
      await this.database.command({ ping: 1 });
      return this.database;
    } catch {
      try { await this.client.close(); } catch { /* already closed */ }
      this.client = this.createClient(this.env);
      this.database = undefined;
      this.connectPromise = undefined;
      return this.db();
    }
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

  async updateMany(collection: string, filter: Filter<RecordDoc>, update: Document): Promise<number> {
    return (await (await this.collection(collection)).updateMany(filter, update)).modifiedCount;
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

export type Mongo = Pick<MongoGateway, "findOne" | "findMany" | "insert" | "update" | "updateMany" | "remove" | "count" | "distinct" | "findOneAndUpdate">;

export function gateway(env: Env): Mongo {
  return env.MONGO_GATEWAY.get(env.MONGO_GATEWAY.idFromName("acolhe-mongodb")) as unknown as Mongo;
}
