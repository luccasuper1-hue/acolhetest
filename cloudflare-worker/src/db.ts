import { MongoClient, type Db, type Document, type Filter, type Sort } from "mongodb";
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";
import { logOperational } from "./observability";
import { gatewayObjectName } from "./runtime";

// Documents are schemaless in the existing Atlas collections. Route-level
// validation narrows external input before it reaches this boundary.
export type RecordDoc = Record<string, any>;
const MAX_ANALYTICS_KEYS_PER_DAY = 100_000;
const MAX_QUERY_LIMIT = 5_000;
const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error &&
  (error as { code?: unknown }).code === 11000;
const minutesFromTime = (value: unknown) => typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : null;
const durationMinutes = (record: RecordDoc) => Number.isInteger(Number(record.duration_minutes)) && Number(record.duration_minutes) >= 15 ? Number(record.duration_minutes) : 30;
const overlaps = (date: string, time: string, duration: number, record: RecordDoc) => {
  if (String(record.date) !== date) return false;
  const start = minutesFromTime(time), other = minutesFromTime(record.time);
  if (start === null || other === null) return false;
  return start < other + durationMinutes(record) && other < start + duration;
};

/** Keeps Atlas' TCP connection alive in one Durable Object. */
export class MongoGateway extends DurableObject<Env> {
  private client: MongoClient;
  private database?: Db;
  private connectPromise?: Promise<Db>;
  // Capacity operations for one professional must be serialized, without
  // blocking unrelated Mongo RPCs (including realtime and dashboard reads).
  private capacityLocks = new Map<string, Promise<void>>();
  private studentLocks = new Map<string, Promise<void>>();
  private authLocks = new Map<string, Promise<void>>();
  private analyticsWindows = new Map<string, { startedAt: number; count: number }>();
  private analyticsCleanupAt = 0;
  private chatWindows = new Map<string, { startedAt: number; count: number }>();
  private chatCleanupAt = 0;
  private inboundWindows = new Map<WebSocket, { startedAt: number; count: number }>();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.client = this.createClient(env);
  }

  private createClient(env: Env) {
    // A single named Durable Object owns this client, so the driver pool is
    // reused across requests instead of opening a Mongo connection per fetch.
    // Keep the pool conservative: every live Durable Object can have its own
    // pool, and a minimum pool would keep idle Atlas sockets open while the DO
    // is hibernated. The idle timeout lets the driver release unused sockets.
    return new MongoClient(env.MONGO_URL, {
      minPoolSize: 0,
      maxPoolSize: 4,
      maxConnecting: 2,
      maxIdleTimeMS: 30_000,
      connectTimeoutMS: 5_000,
      serverSelectionTimeoutMS: 5_000,
      socketTimeoutMS: 15_000,
      waitQueueTimeoutMS: 15_000,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/realtime/broadcast" && request.method === "POST") {
      const raw = await request.arrayBuffer().catch(() => new ArrayBuffer(0));
      if (raw.byteLength > 32 * 1024) return new Response("Payload too large", { status: 413 });
      const payload = (() => { try { return JSON.parse(new TextDecoder().decode(raw)); } catch { return null; } })() as { sessionId?: string; userId?: string; userIds?: string[]; institutionId?: string; event?: unknown } | null;
      if (payload?.event && typeof payload.event === "object" && !Array.isArray(payload.event)) this.broadcast(payload);
      return new Response(null, { status: 204 });
    }
    if (url.pathname !== "/realtime/socket" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Not found", { status: 404 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const metadata = { sessionId: request.headers.get("x-realtime-session") || undefined, userId: request.headers.get("x-realtime-user") || undefined, institutionId: request.headers.get("x-realtime-institution") || undefined, role: request.headers.get("x-realtime-role") || undefined };
    this.ctx.acceptWebSocket(server, [metadata.sessionId ? `session:${metadata.sessionId}` : "user"]);
    server.serializeAttachment(metadata);
    if (metadata.sessionId && metadata.userId) this.broadcast({ sessionId: metadata.sessionId, event: { type: "presence", role: metadata.role, online: true } });
    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcast(payload: { sessionId?: string; userId?: string; userIds?: string[]; institutionId?: string; event?: unknown }) {
    const message = JSON.stringify(payload.event);
    const recipients = new Set((payload.userIds || []).filter(Boolean));
    if (payload.userId) recipients.add(payload.userId);
    for (const socket of this.ctx.getWebSockets()) {
      const metadata = (socket.deserializeAttachment() as { sessionId?: string; userId?: string; institutionId?: string } | null) || {};
      const matchesSession = payload.sessionId && metadata.sessionId === payload.sessionId;
      const matchesUser = metadata.userId && recipients.has(metadata.userId);
      const matchesInstitution = payload.institutionId && metadata.institutionId === payload.institutionId;
      if (!matchesSession && !matchesUser && !matchesInstitution) continue;
      try { socket.send(message); } catch { socket.close(1011, "broadcast failed"); }
    }
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if ((typeof message === "string" ? new TextEncoder().encode(message).byteLength : message.byteLength) > 16 * 1024) return;
    const timestamp = Date.now();
    const window = this.inboundWindows.get(socket);
    if (!window || timestamp - window.startedAt >= 10_000) this.inboundWindows.set(socket, { startedAt: timestamp, count: 1 });
    else {
      window.count += 1;
      if (window.count > 120) return;
    }
    let payload: { type?: string; active?: boolean; messageId?: string } | null = null;
    try { payload = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { return; }
    const metadata = (socket.deserializeAttachment() as { sessionId?: string; userId?: string; role?: string } | null) || {};
    if (!metadata.userId || !payload?.type) return;
    if (payload.type === "ping") {
      try { socket.send(JSON.stringify({ type: "pong", at: new Date().toISOString() })); } catch { socket.close(1011, "heartbeat failed"); }
      return;
    }
    if (!metadata.sessionId) return;
    if (payload.type === "typing") this.broadcast({ sessionId: metadata.sessionId, event: { type: "typing", role: metadata.role, active: Boolean(payload.active) } });
    if (payload.type === "read" && payload.messageId) {
      const readAt = new Date().toISOString();
      let persisted = false;
      try {
        const changed = await (await this.collection("session_messages")).updateOne({ id: payload.messageId, session_id: metadata.sessionId, sender_user_id: { $ne: metadata.userId } }, { $set: { read_at: readAt, read_by: metadata.userId } });
        persisted = changed.modifiedCount === 1;
      } catch (error) {
        logOperational("chat_read_receipt_persistence_failed", { error_name: error instanceof Error ? error.name : "unknown" });
      }
      if (persisted) this.broadcast({ sessionId: metadata.sessionId, event: { type: "message_read", messageId: payload.messageId, readAt } });
    }
  }
  webSocketClose(socket: WebSocket) {
    this.inboundWindows.delete(socket);
    const metadata = (socket.deserializeAttachment() as { sessionId?: string; userId?: string; role?: string } | null) || {};
    if (!metadata.sessionId || !metadata.userId) return;
    // A user may have the conversation open in multiple tabs/devices. A
    // single socket closing must not announce them as offline while another
    // socket for the same conversation is still alive.
    const stillConnected = this.ctx.getWebSockets().some(other => {
      if (other === socket) return false;
      const otherMetadata = (other.deserializeAttachment() as { sessionId?: string; userId?: string } | null) || {};
      return otherMetadata.sessionId === metadata.sessionId && otherMetadata.userId === metadata.userId;
    });
    if (!stillConnected) this.broadcast({ sessionId: metadata.sessionId, event: { type: "presence", role: metadata.role, online: false } });
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
    // The Mongo driver checks out/reconnects sockets for each operation. A
    // separate ping here doubled every RPC's round trips and made writes with
    // several dependent operations exceed the browser's request timeout.
    return this.database;
  }

  private async withCapacityLock<T>(professionalId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.capacityLocks.get(professionalId);
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    this.capacityLocks.set(professionalId, current);
    if (previous) await previous;
    try { return await action(); }
    finally {
      if (this.capacityLocks.get(professionalId) === current) this.capacityLocks.delete(professionalId);
      release();
    }
  }

  private async withCapacityLocks<T>(professionalIds: string[], action: () => Promise<T>): Promise<T> {
    const ordered = [...new Set(professionalIds.map(String).filter(Boolean))].sort();
    const acquire = (index: number): Promise<T> => index >= ordered.length
      ? action()
      : this.withCapacityLock(ordered[index], () => acquire(index + 1));
    return acquire(0);
  }

  private async withStudentLock<T>(studentId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.studentLocks.get(studentId);
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    this.studentLocks.set(studentId, current);
    if (previous) await previous;
    try { return await action(); }
    finally {
      if (this.studentLocks.get(studentId) === current) this.studentLocks.delete(studentId);
      release();
    }
  }

  private async withAuthLock<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.authLocks.get(key);
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    this.authLocks.set(key, current);
    if (previous) await previous;
    try { return await action(); }
    finally {
      if (this.authLocks.get(key) === current) this.authLocks.delete(key);
      release();
    }
  }

  async recordLoginFailure(identifier: string, maxAttempts: number, lockUntil: string): Promise<void> {
    await this.withAuthLock(`login:${identifier}`, async () => {
      const existing = await this.findOne("login_attempts", { identifier });
      const count = Number(existing?.count || 0) + 1;
      await this.update("login_attempts", { identifier }, { $set: { identifier, count: count >= maxAttempts ? 0 : count, updated_at: new Date().toISOString(), ...(count >= maxAttempts ? { locked_until: lockUntil } : {}) } }, true);
    });
  }

  /** Serializes the complete login decision so concurrent attempts cannot bypass a lock. */
  async finalizeLogin(identifier: string, validCredentials: boolean, maxAttempts: number, lockUntil: string): Promise<"ok" | "invalid" | "locked"> {
    return this.withAuthLock(`login:${identifier}`, async () => {
      const existing = await this.findOne("login_attempts", { identifier });
      if (existing?.locked_until && String(existing.locked_until) > new Date().toISOString()) return "locked";
      if (validCredentials) {
        await this.remove("login_attempts", { identifier });
        return "ok";
      }
      const count = Number(existing?.count || 0) + 1;
      await this.update("login_attempts", { identifier }, { $set: { identifier, count: count >= maxAttempts ? 0 : count, updated_at: new Date().toISOString(), ...(count >= maxAttempts ? { locked_until: lockUntil } : {}) } }, true);
      return "invalid";
    });
  }

  async savePasswordReset(userId: string, record: RecordDoc): Promise<boolean> {
    return this.withAuthLock(`reset:${userId}`, async () => {
      const existing = await this.findOne("password_reset_tokens", { user_id: userId }, { created_at: 1 });
      if (existing?.created_at && Date.now() - Date.parse(String(existing.created_at)) < 60_000) return false;
      await this.update("password_reset_tokens", { user_id: userId }, { $set: record }, true);
      return true;
    });
  }

  async createLead(lead: RecordDoc): Promise<RecordDoc> {
    return this.withAuthLock(`lead:${lead.kind}:${lead.email}`, async () => {
      const existing = await this.findOne("leads", { kind: lead.kind, email: lead.email, status: "pending" });
      if (existing) return existing;
      await this.insert("leads", lead);
      return lead;
    });
  }

  /** Creates a student account and profile once, even if registration is retried concurrently. */
  async createStudentAccount(user: RecordDoc, student: RecordDoc): Promise<"created" | "exists"> {
    return this.withAuthLock(`register:${String(user.email).toLowerCase()}`, async () => {
      const database = await this.db();
      if (await database.collection<RecordDoc>("users").findOne({ email: user.email }, { projection: { _id: 1 } })) return "exists";
      const session = this.client.startSession();
      try {
        await session.withTransaction(async () => {
          await database.collection<RecordDoc>("users").insertOne(user, { session });
          await database.collection<RecordDoc>("students").insertOne(student, { session });
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
        return "created";
      } finally { await session.endSession(); }
    });
  }

  /** Creates an institutional professional invite atomically per e-mail. */
  async createProfessionalInvite(user: RecordDoc, professional: RecordDoc): Promise<"created" | "exists"> {
    return this.withAuthLock(`invite:${String(user.email).toLowerCase()}`, async () => {
      const database = await this.db();
      if (await database.collection<RecordDoc>("users").findOne({ email: user.email }, { projection: { _id: 1 } })) return "exists";
      const session = this.client.startSession();
      try {
        await session.withTransaction(async () => {
          await database.collection<RecordDoc>("users").insertOne(user, { session });
          await database.collection<RecordDoc>("professionals").insertOne(professional, { session });
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
        return "created";
      } finally { await session.endSession(); }
    });
  }

  /** Creates an institution and optional manager as one serialized transaction. */
  async createInstitution(institution: RecordDoc, manager: RecordDoc | null): Promise<"created" | "code_exists" | "email_exists"> {
    return this.withAuthLock(`institution:${String(institution.code).toUpperCase()}`, async () => {
      const database = await this.db();
      // The collection has a unique code index, including archived records;
      // report the conflict consistently instead of surfacing a transaction
      // duplicate-key error as a generic 503.
      if (await database.collection<RecordDoc>("institutions").findOne({ code: institution.code }, { projection: { _id: 1 } })) return "code_exists";
      if (manager && await database.collection<RecordDoc>("users").findOne({ email: manager.email }, { projection: { _id: 1 } })) return "email_exists";
      const session = this.client.startSession();
      try {
        await session.withTransaction(async () => {
          await database.collection<RecordDoc>("institutions").insertOne(institution, { session });
          if (manager) await database.collection<RecordDoc>("users").insertOne(manager, { session });
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
        return "created";
      } catch (error: unknown) {
        if (isDuplicateKeyError(error)) {
          if (manager && await database.collection<RecordDoc>("users").findOne({ email: manager.email }, { projection: { _id: 1 } })) return "email_exists";
          if (await database.collection<RecordDoc>("institutions").findOne({ code: institution.code }, { projection: { _id: 1 } })) return "code_exists";
        }
        throw error;
      } finally { await session.endSession(); }
    });
  }

  /** Claims and approves an institutional lead with account creation in one transaction. */
  async approveInstitutionLead(leadId: string, institution: RecordDoc, manager: RecordDoc | null, updatedAt: string): Promise<"created" | "lead_changed" | "code_exists" | "email_exists"> {
    return this.withAuthLock(`lead:${leadId}`, async () => {
      const database = await this.db();
      const lead = await database.collection<RecordDoc>("leads").findOne({ id: leadId, kind: "institution", status: { $nin: ["approved", "contacted"] } }, { projection: { _id: 1 }, });
      if (!lead) return "lead_changed";
      if (await database.collection<RecordDoc>("institutions").findOne({ code: institution.code }, { projection: { _id: 1 } })) return "code_exists";
      if (manager && await database.collection<RecordDoc>("users").findOne({ email: manager.email }, { projection: { _id: 1 } })) return "email_exists";
      const session = this.client.startSession();
      try {
        await session.withTransaction(async () => {
          await database.collection<RecordDoc>("institutions").insertOne(institution, { session });
          if (manager) await database.collection<RecordDoc>("users").insertOne(manager, { session });
          await database.collection<RecordDoc>("leads").updateOne({ id: leadId, kind: "institution", status: { $nin: ["approved", "contacted"] } }, { $set: { status: "approved", updated_at: updatedAt, ...(manager ? { account_created_at: updatedAt, account_email: manager.email, institution_code: institution.code } : {}) }, ...(manager ? { $unset: { manager_password_hash: "" } } : {}) }, { session });
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
        return "created";
      } catch (error: unknown) {
        if (isDuplicateKeyError(error)) return "code_exists";
        throw error;
      } finally { await session.endSession(); }
    });
  }

  /** Creates either request kind while serializing active-request checks per student. */
  async createStudentRequest(collection: "requests" | "appointment_requests", record: RecordDoc): Promise<"created" | "active"> {
    return this.withStudentLock(String(record.student_id), async () => {
      const database = await this.db();
      const active = await database.collection<RecordDoc>("requests").findOne({ student_id: record.student_id, status: { $in: ["pending", "accepted"] } }, { projection: { _id: 1 } });
      const activeDirect = await database.collection<RecordDoc>("appointment_requests").findOne({ student_id: record.student_id, status: { $in: ["pending", "proposed"] } }, { projection: { _id: 1 } });
      if (active || activeDirect) return "active";
      await database.collection<RecordDoc>(collection).insertOne(record);
      return "created";
    });
  }

  /** Reserves a published slot and creates the student's request atomically. */
  async createPublishedStudentRequest(record: RecordDoc): Promise<"created" | "active" | "conflict"> {
    return this.withCapacityLock(String(record.professional_id), async () => this.withStudentLock(String(record.student_id), async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const active = await database.collection<RecordDoc>("requests").findOne({ student_id: record.student_id, status: { $in: ["pending", "accepted"] } }, { projection: { _id: 1 }, session });
          const activeDirect = await database.collection<RecordDoc>("appointment_requests").findOne({ student_id: record.student_id, status: { $in: ["pending", "proposed"] } }, { projection: { _id: 1 }, session });
          if (active || activeDirect) return "active";
          const slots = database.collection<RecordDoc>("availability");
          const slot = await slots.findOne({ id: record.availability_id, professional_id: record.professional_id, status: "open" }, { projection: { _id: 0 }, session });
          if (!slot) return "conflict";
          const duration = durationMinutes(slot);
          const availability = await slots.find({ professional_id: record.professional_id, date: slot.date, status: { $in: ["open", "reserved"] }, id: { $ne: slot.id } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const sessions = await database.collection<RecordDoc>("sessions").find({ professional_id: record.professional_id, date: slot.date, status: "scheduled" }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const proposals = await database.collection<RecordDoc>("appointment_requests").find({ professional_id: record.professional_id, date: slot.date, status: { $in: ["proposed", "accepted"] } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          if ([...availability, ...sessions, ...proposals].some(other => overlaps(String(slot.date), String(slot.time), duration, other))) return "conflict";
          if (!(await slots.updateOne({ id: slot.id, status: "open" }, { $set: { status: "reserved" } }, { session })).modifiedCount) return "conflict";
          await database.collection<RecordDoc>("requests").insertOne({ ...record, duration_minutes: duration }, { session });
          return "created";
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    }));
  }

  async issueCertificate(professionalId: string, certificate: RecordDoc): Promise<RecordDoc> {
    if (!certificate.institution_id) throw new Error("certificate.institution_id is required");
    if (!certificate.professional_id || String(certificate.professional_id) !== String(professionalId)) throw new Error("certificate professional scope mismatch");
    return this.withCapacityLock(professionalId, async () => {
      const existing = await this.findOne("certificates", { professional_id: professionalId, status: "valid" });
      if (existing) {
        if (existing.institution_id !== certificate.institution_id) throw new Error("certificate institution scope mismatch");
        return existing;
      }
      await this.insert("certificates", certificate);
      return certificate;
    });
  }

  async saveFeedback(record: RecordDoc): Promise<RecordDoc> {
    return this.withStudentLock(String(record.student_id), async () => {
      const existing = await this.findOne("feedback", { session_id: record.session_id });
      if (existing) {
        await this.update("feedback", { session_id: record.session_id }, { $set: record });
        return record;
      }
      await this.insert("feedback", record);
      return record;
    });
  }

  async createAvailabilityBatch(professionalId: string, slots: RecordDoc[]): Promise<"created" | "conflict"> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const dates = [...new Set(slots.map(slot => slot.date))];
          const existing = await database.collection<RecordDoc>("availability").find({ professional_id: professionalId, date: { $in: dates }, status: { $in: ["open", "reserved"] } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const overlap = (date: string, time: string, duration: number, record: RecordDoc) => {
            if (String(record.date) !== date) return false;
            const parse = (value: unknown) => typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : null;
            const start = parse(time), other = parse(record.time), otherDuration = Number.isInteger(Number(record.duration_minutes)) && Number(record.duration_minutes) >= 15 ? Number(record.duration_minutes) : 30;
            return start !== null && other !== null && start < other + otherDuration && other < start + duration;
          };
          for (const slot of slots) {
            const duration = Number(slot.duration_minutes) || 30;
            if (existing.some(record => overlap(String(slot.date), String(slot.time), duration, record))) return "conflict";
            if (slots.some(other => other !== slot && overlap(String(slot.date), String(slot.time), duration, other))) return "conflict";
          }
          if (slots.length) await database.collection<RecordDoc>("availability").insertMany(slots, { session, ordered: true });
          return "created";
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  private collection(name: string) {
    return this.db().then((database) => database.collection<RecordDoc>(name));
  }

  async ping(): Promise<void> {
    // A regular read is more portable across Atlas-compatible deployments
    // than relying on the admin `ping` command, which may be denied while
    // application collections remain available.
    await (await this.db()).collection<RecordDoc>("users").findOne({}, { projection: { _id: 1 } });
  }

  async findOne(collection: string, filter: Filter<RecordDoc>, projection?: Record<string, 0 | 1>): Promise<RecordDoc | null> {
    const startedAt = Date.now();
    const result = await (await this.collection(collection)).findOne(filter, { projection: { _id: 0, ...projection } });
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 1_000) logOperational("mongo_query_slow", { collection, operation: "findOne", duration_ms: durationMs });
    return result as RecordDoc | null;
  }

  async findMany(collection: string, filter: Filter<RecordDoc>, options: { projection?: Record<string, 0 | 1>; sort?: Sort; limit?: number } = {}): Promise<RecordDoc[]> {
    const requestedLimit = options.limit;
    const limit = requestedLimit === undefined ? undefined : Math.min(MAX_QUERY_LIMIT, Math.max(1, Math.trunc(requestedLimit)));
    const startedAt = Date.now();
    const cursor = (await this.collection(collection)).find(filter, { projection: { _id: 0, ...options.projection }, sort: options.sort, limit });
    const rows = await cursor.toArray() as RecordDoc[];
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 1_000) logOperational("mongo_query_slow", { collection, operation: "findMany", duration_ms: durationMs, result_count: rows.length, ...(limit === undefined ? {} : { limit }) });
    return rows;
  }

  async insert(collection: string, value: RecordDoc): Promise<void> {
    await (await this.collection(collection)).insertOne(value);
  }

  /** Inserts a record once while serializing the check in this gateway. */
  async insertIfAbsent(collection: string, filter: Filter<RecordDoc>, value: RecordDoc, lockKey: string): Promise<boolean> {
    return this.withAuthLock(`insert-once:${lockKey}`, async () => {
      if (await this.findOne(collection, filter, { _id: 0 })) return false;
      await this.insert(collection, value);
      return true;
    });
  }

  async update(collection: string, filter: Filter<RecordDoc>, update: Document, upsert = false): Promise<number> {
    // Return matchedCount, not modifiedCount.  A valid idempotent write (for
    // example marking an already-read notification) still matched a record,
    // and callers use this value to distinguish a race from a no-op update.
    const result = await (await this.collection(collection)).updateOne(filter, update, { upsert });
    return result.matchedCount || result.upsertedCount;
  }

  /** Records one consented public page view per visitor/page/day. */
  async recordAnalyticsPageView(day: string, visitorHash: string, pageKey: string, increments: RecordDoc, rateKey: string): Promise<boolean> {
    const timestamp = Date.now();
    const window = this.analyticsWindows.get(rateKey);
    if (!window || timestamp - window.startedAt >= 60_000) this.analyticsWindows.set(rateKey, { startedAt: timestamp, count: 1 });
    else {
      window.count += 1;
      if (window.count > 120) return false;
    }
    if (timestamp - this.analyticsCleanupAt >= 60_000) {
      for (const [key, current] of this.analyticsWindows) if (timestamp - current.startedAt >= 60_000) this.analyticsWindows.delete(key);
      this.analyticsCleanupAt = timestamp;
    }
    return this.withAuthLock(`analytics:${day}:${pageKey}`, async () => {
      const existing = await this.findOne("analytics_daily", { day }, { page_view_keys: 1 });
      const pageViewKeys = Array.isArray(existing?.page_view_keys) ? existing.page_view_keys : [];
      if (pageViewKeys.includes(pageKey)) return false;
      if (pageViewKeys.length >= MAX_ANALYTICS_KEYS_PER_DAY) return false;
      await this.update("analytics_daily", { day }, {
        $setOnInsert: { id: crypto.randomUUID(), day, created_at: new Date().toISOString() },
        $inc: increments,
        $addToSet: { visitor_hashes: visitorHash, page_view_keys: pageKey },
      }, true);
      return true;
    });
  }

  /** Limits REST chat writes per authenticated user and conversation. */
  allowChatMessage(userId: string, sessionId: string, maxMessages = 30, windowMs = 60_000): { allowed: boolean; retryAfterSeconds: number } {
    const timestamp = Date.now();
    if (timestamp - this.chatCleanupAt >= windowMs) {
      for (const [key, current] of this.chatWindows) if (timestamp - current.startedAt >= windowMs) this.chatWindows.delete(key);
      this.chatCleanupAt = timestamp;
    }
    const key = `${userId}:${sessionId}`;
    const current = this.chatWindows.get(key);
    if (!current || timestamp - current.startedAt >= windowMs) {
      this.chatWindows.set(key, { startedAt: timestamp, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= maxMessages) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (timestamp - current.startedAt)) / 1000)) };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  async updateMany(collection: string, filter: Filter<RecordDoc>, update: Document): Promise<number> {
    return (await (await this.collection(collection)).updateMany(filter, update)).modifiedCount;
  }

  async remove(collection: string, filter: Filter<RecordDoc>, many = false): Promise<number> {
    const result = many ? await (await this.collection(collection)).deleteMany(filter) : await (await this.collection(collection)).deleteOne(filter);
    return result.deletedCount;
  }

  /** Commit account and dependent-record removal as one Atlas transaction. */
  async deleteAccount(userId: string, initiatedBy: { kind: "self" | "admin"; adminId?: string }): Promise<{ id: string; role: string; institution_id?: string } | null> {
    const database = await this.db();
    const session = this.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const users = database.collection<RecordDoc>("users");
        const user = await users.findOne({ id: userId }, { session });
        if (!user || user.role === "admin") return null;
        const profileCollection = user.role === "student" ? "students" : user.role === "professional" ? "professionals" : null;
        const profile = profileCollection
          ? await database.collection<RecordDoc>(profileCollection).findOne({ user_id: userId }, { session })
          : null;
        if (profile) {
          const profileField = user.role === "student" ? "student_id" : "professional_id";
          const sessionRows = await database.collection<RecordDoc>("sessions")
            .find({ [profileField]: profile.id }, { projection: { id: 1 }, session }).toArray();
          const sessionIds = sessionRows.map(row => row.id);
          if (sessionIds.length) {
            const filter = { session_id: { $in: sessionIds } };
            await database.collection("referrals").deleteMany(filter, { session });
            await database.collection("feedback").deleteMany(filter, { session });
            await database.collection("session_messages").deleteMany(filter, { session });
          }
          // Also remove messages authored by the account in case a legacy
          // session record is missing or was already archived.
          await database.collection("session_messages").deleteMany({ sender_user_id: userId }, { session });
          if (user.role === "professional") {
            await database.collection("availability").deleteMany({ professional_id: profile.id }, { session });
          }
          await database.collection("availability_interests").deleteMany({ [profileField]: profile.id }, { session });
          await database.collection("appointment_requests").deleteMany({ [profileField]: profile.id }, { session });
          await database.collection("requests").deleteMany({ [profileField]: profile.id }, { session });
          await database.collection("sessions").deleteMany({ [profileField]: profile.id }, { session });
          await database.collection(profileCollection!).deleteOne({ id: profile.id }, { session });
        }
        await database.collection("notifications").deleteMany({ recipient_user_id: userId }, { session });
        await database.collection("password_reset_tokens").deleteMany({ user_id: userId }, { session });
        if (user.email) await database.collection("login_attempts").deleteMany({ identifier: user.email }, { session });
        // Operational audit events remain, but can no longer identify the deleted account.
        const events = database.collection("events");
        await events.updateMany({ user_id: userId }, { $set: { user_id: null } }, { session });
        await users.deleteOne({ id: userId }, { session });
        await events.insertOne({
          id: crypto.randomUUID(),
          type: initiatedBy.kind === "self" ? "user_deleted_self" : "user_deleted",
          user_id: initiatedBy.kind === "admin" ? initiatedBy.adminId : "system",
          role: initiatedBy.kind === "self" ? user.role : "admin",
          institution_id: user.institution_id,
          meta: { role: user.role, ...(initiatedBy.kind === "admin" ? { target: userId } : {}) },
          created_at: new Date().toISOString(),
        }, { session });
        return { id: String(user.id), role: String(user.role), institution_id: user.institution_id ? String(user.institution_id) : undefined };
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } finally {
      await session.endSession();
    }
  }

  async count(collection: string, filter: Filter<RecordDoc> = {}): Promise<number> {
    return (await this.collection(collection)).countDocuments(filter);
  }

  /** Runs bounded count probes in one Durable Object RPC for admin summaries. */
  async countMany(plans: { collection: string; filter?: Filter<RecordDoc> }[]): Promise<number[]> {
    const allowed = new Set(["users", "students", "professionals", "requests", "appointment_requests", "sessions", "referrals", "events"]);
    if (!Array.isArray(plans) || plans.length > 24 || plans.some((plan) => !allowed.has(plan.collection) || !plan.filter || typeof plan.filter !== "object")) throw new Error("Invalid count batch");
    const database = await this.db();
    return Promise.all(plans.map((plan) => database.collection<RecordDoc>(plan.collection).countDocuments(plan.filter)));
  }

  /**
   * Bounded dashboard read plans. These keep the Worker->Durable Object hop
   * to one RPC per panel while retaining the existing route response shapes.
   * They intentionally return raw, non-clinical records for route-level
   * allowlisting and formatting.
   */
  async getStudentDashboard(studentId: string, institutionId: string, summary = false): Promise<{ requests: RecordDoc[]; appointmentRequests: RecordDoc[]; professionals: RecordDoc[]; professionalAccounts: RecordDoc[]; professionalAvailability: RecordDoc[]; availabilityInterest: RecordDoc | null }> {
    const database = await this.db();
    const requestStatuses = summary ? { status: { $in: ["pending", "accepted"] } } : {};
    const appointmentStatuses = summary ? { status: { $in: ["pending", "proposed", "accepted"] } } : {};
    const [requests, appointmentRequests, professionals, availabilityInterests] = await Promise.all([
      database.collection<RecordDoc>("requests").find({ student_id: studentId, ...requestStatuses }, { projection: { _id: 0 }, sort: { date: 1, time: 1 }, limit: summary ? 50 : 100 }).toArray(),
      database.collection<RecordDoc>("appointment_requests").find({ student_id: studentId, ...appointmentStatuses }, { projection: { _id: 0 }, sort: { created_at: -1 }, limit: summary ? 30 : 50 }).toArray(),
      database.collection<RecordDoc>("professionals").find({ institution_id: institutionId }, { projection: { _id: 0, id: 1, user_id: 1, specialty: 1, link_type: 1 }, limit: 50 }).toArray(),
      database.collection<RecordDoc>("availability_interests").findOne({ student_id: studentId, institution_id: institutionId, status: "waiting" }, { projection: { _id: 0 } }),
    ]);
    const professionalIds = professionals.map((professional) => professional.id).filter(Boolean);
    const [professionalAccounts, professionalAvailability] = await Promise.all([
      professionalIds.length ? database.collection<RecordDoc>("users").find({ id: { $in: professionals.map((professional) => professional.user_id).filter(Boolean) }, institution_id: institutionId }, { projection: { _id: 0, id: 1, name: 1, active: 1 }, limit: 100 }).toArray() : Promise.resolve([]),
      professionalIds.length ? database.collection<RecordDoc>("availability").find({ professional_id: { $in: professionalIds }, status: "open", date: { $gte: new Date().toISOString().slice(0, 10) } }, { projection: { _id: 0, id: 1, professional_id: 1, date: 1, time: 1, mode: 1, location: 1, duration_minutes: 1, status: 1 }, sort: { date: 1, time: 1 }, limit: 200 }).toArray() : Promise.resolve([]),
    ]);
    return { requests, appointmentRequests, professionals, professionalAccounts, professionalAvailability, availabilityInterest: availabilityInterests || null };
  }

  async getProfessionalDashboard(professionalId: string, institutionId: string): Promise<{ availability: RecordDoc[]; requests: RecordDoc[]; sessions: RecordDoc[]; availabilityInterests: RecordDoc[]; appointmentRequests: RecordDoc[]; appointmentStudents: RecordDoc[]; appointmentStudentUsers: RecordDoc[]; requestSessions: RecordDoc[]; sessionRequests: RecordDoc[]; referrals: RecordDoc[]; sessionStudents: RecordDoc[]; sessionStudentUsers: RecordDoc[] }> {
    const database = await this.db();
    const [availability, requests, sessions, availabilityInterests, appointmentRequests] = await Promise.all([
      database.collection<RecordDoc>("availability").find({ professional_id: professionalId, date: { $gte: new Date().toISOString().slice(0, 10) } }, { projection: { _id: 0, id: 1, date: 1, time: 1, mode: 1, location: 1, duration_minutes: 1, status: 1 }, sort: { date: 1, time: 1 }, limit: 200 }).toArray(),
      database.collection<RecordDoc>("requests").find({ professional_id: professionalId }, { projection: { _id: 0 }, sort: { date: 1, time: 1 }, limit: 200 }).toArray(),
      database.collection<RecordDoc>("sessions").find({ professional_id: professionalId }, { projection: { _id: 0 }, sort: { date: 1, time: 1 }, limit: 200 }).toArray(),
      database.collection<RecordDoc>("availability_interests").find({ institution_id: institutionId, status: "waiting" }, { projection: { _id: 0, reason_code: 1 }, limit: 100 }).toArray(),
      database.collection<RecordDoc>("appointment_requests").find({ professional_id: professionalId, status: { $in: ["pending", "proposed"] } }, { projection: { _id: 0 }, sort: { created_at: -1 }, limit: 50 }).toArray(),
    ]);
    const appointmentStudentIds = [...new Set(appointmentRequests.map((record) => String(record.student_id || "")).filter(Boolean))];
    const requestIds = requests.map((record) => record.id).filter(Boolean);
    const sessionRequestIds = sessions.map((session) => session.request_id).filter(Boolean);
    const sessionStudentIds = [...new Set(sessions.map((session) => String(session.student_id || "")).filter(Boolean))];
    const [appointmentStudents, requestSessions, sessionRequests, referrals, sessionStudents] = await Promise.all([
      appointmentStudentIds.length ? database.collection<RecordDoc>("students").find({ id: { $in: appointmentStudentIds } }, { projection: { _id: 0, id: 1, user_id: 1 }, limit: 50 }).toArray() : Promise.resolve([]),
      requestIds.length ? database.collection<RecordDoc>("sessions").find({ request_id: { $in: requestIds } }, { projection: { _id: 0 }, limit: 200 }).toArray() : Promise.resolve([]),
      sessionRequestIds.length ? database.collection<RecordDoc>("requests").find({ id: { $in: sessionRequestIds } }, { projection: { _id: 0 }, limit: 200 }).toArray() : Promise.resolve([]),
      sessions.length ? database.collection<RecordDoc>("referrals").find({ session_id: { $in: sessions.map((session) => session.id) } }, { projection: { _id: 0 }, limit: 200 }).toArray() : Promise.resolve([]),
      sessionStudentIds.length ? database.collection<RecordDoc>("students").find({ id: { $in: sessionStudentIds } }, { projection: { _id: 0, id: 1, user_id: 1 }, limit: 200 }).toArray() : Promise.resolve([]),
    ]);
    const appointmentUserIds = appointmentStudents.map((student) => student.user_id).filter(Boolean);
    const sessionUserIds = sessionStudents.map((student) => student.user_id).filter(Boolean);
    const userIds = [...new Set([...appointmentUserIds, ...sessionUserIds])];
    const users = userIds.length ? await database.collection<RecordDoc>("users").find({ id: { $in: userIds } }, { projection: { _id: 0, id: 1, name: 1 }, limit: 200 }).toArray() : [];
    const appointmentStudentUserIds = new Set(appointmentUserIds.map(String));
    const sessionStudentUserIds = new Set(sessionUserIds.map(String));
    return { availability, requests, sessions, availabilityInterests, appointmentRequests, appointmentStudents, appointmentStudentUsers: users.filter((user) => appointmentStudentUserIds.has(String(user.id))), requestSessions, sessionRequests, referrals, sessionStudents, sessionStudentUsers: users.filter((user) => sessionStudentUserIds.has(String(user.id))) };
  }

  async getInstitutionDashboard(institutionId: string): Promise<{ professionalIds: string[]; certificates: RecordDoc[]; requests: RecordDoc[]; appointmentRequests: RecordDoc[]; minorRegistrations: RecordDoc[] }> {
    const database = await this.db();
    const professionals = await database.collection<RecordDoc>("professionals").find({ institution_id: institutionId }, { projection: { _id: 0, id: 1 }, limit: 200 }).toArray();
    const professionalIds = professionals.map(record => record.id).filter(Boolean);
    const [certificates, requests, appointmentRequests, minorRegistrations] = await Promise.all([
      professionalIds.length ? database.collection<RecordDoc>("certificates").find({ institution_id: institutionId, professional_id: { $in: professionalIds } }, { projection: { _id: 0, id: 1, code: 1, title: 1, professional_name: 1, institution_id: 1, completed_count: 1, issued_at: 1, status: 1, revoked_at: 1 }, sort: { issued_at: -1 }, limit: 200 }).toArray() : Promise.resolve([]),
      database.collection<RecordDoc>("requests").find({ institution_id: institutionId, status: "pending" }, { projection: { _id: 0 }, sort: { created_at: 1 }, limit: 50 }).toArray(),
      database.collection<RecordDoc>("appointment_requests").find({ institution_id: institutionId, status: "pending" }, { projection: { _id: 0 }, sort: { created_at: 1 }, limit: 50 }).toArray(),
      database.collection<RecordDoc>("users").find({ institution_id: institutionId, role: "student", age_band: "child", guardian_review_status: "pending_institution_review" }, { projection: { _id: 0, id: 1, name: 1, guardian_name: 1, guardian_email: 1, created_at: 1 }, sort: { created_at: 1 }, limit: 50 }).toArray(),
    ]);
    return { professionalIds, certificates, requests, appointmentRequests, minorRegistrations };
  }

  async getAdminSummary(): Promise<{ users: RecordDoc[]; requests: RecordDoc[]; appointmentRequests: RecordDoc[]; leads: RecordDoc[]; institutions: RecordDoc[]; certificates: RecordDoc[]; institutionStudentCounts: RecordDoc[]; institutionProfessionalCounts: RecordDoc[] }> {
    const database = await this.db();
    const [users, requests, appointmentRequests, leads, institutions, certificates] = await Promise.all([
      database.collection<RecordDoc>("users").find({}, { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, institution_id: 1, active: 1, created_at: 1 }, sort: { created_at: -1 }, limit: 200 }).toArray(),
      database.collection<RecordDoc>("requests").find({}, { projection: { _id: 0 }, sort: { created_at: -1 }, limit: 200 }).toArray(),
      database.collection<RecordDoc>("appointment_requests").find({}, { projection: { _id: 0 }, sort: { created_at: -1 }, limit: 200 }).toArray(),
      database.collection<RecordDoc>("leads").find({}, { projection: { _id: 0 }, sort: { created_at: -1 }, limit: 100 }).toArray(),
      database.collection<RecordDoc>("institutions").find({}, { projection: { _id: 0 }, limit: 200 }).toArray(),
      database.collection<RecordDoc>("certificates").find({}, { projection: { _id: 0 }, sort: { issued_at: -1 }, limit: 100 }).toArray(),
    ]);
    const [institutionStudentCounts, institutionProfessionalCounts] = await Promise.all([
      database.collection<RecordDoc>("students").aggregate([{ $match: { institution_id: { $exists: true, $ne: null } } }, { $group: { _id: "$institution_id", count: { $sum: 1 } } }, { $project: { _id: 0, institution_id: "$_id", count: 1 } }], { maxTimeMS: 3_000 }).toArray(),
      database.collection<RecordDoc>("professionals").aggregate([{ $match: { institution_id: { $exists: true, $ne: null } } }, { $group: { _id: "$institution_id", count: { $sum: 1 } } }, { $project: { _id: 0, institution_id: "$_id", count: 1 } }], { maxTimeMS: 3_000 }).toArray(),
    ]);
    return { users, requests, appointmentRequests, leads, institutions, certificates, institutionStudentCounts: institutionStudentCounts as RecordDoc[], institutionProfessionalCounts: institutionProfessionalCounts as RecordDoc[] };
  }

  /**
   * Runs a bounded, read-only aggregation in Atlas. Keeping aggregation at
   * the database boundary prevents dashboard metrics from materialising large
   * collections inside the Worker/DO. Callers must provide a finite pipeline
   * and a small result shape; this is intentionally not exposed to routes.
   */
  async aggregate(collection: string, pipeline: Document[], options: { maxTimeMS?: number } = {}): Promise<RecordDoc[]> {
    const startedAt = Date.now();
    const result = await (await this.collection(collection))
      .aggregate(pipeline, { maxTimeMS: options.maxTimeMS ?? 3_000 })
      .toArray() as RecordDoc[];
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 1_000) logOperational("mongo_query_slow", { collection, operation: "aggregate", duration_ms: durationMs, result_count: result.length });
    return result;
  }

  /** Executes a bounded, allowlisted batch of read-only aggregations in one DO RPC. */
  async aggregateMany(plans: { collection: string; pipeline: Document[] }[], options: { maxTimeMS?: number } = {}): Promise<RecordDoc[][]> {
    const allowed = new Set(["students", "professionals", "requests", "appointment_requests", "sessions", "availability", "feedback", "referrals"]);
    if (!Array.isArray(plans) || plans.length > 12 || plans.some((plan) => !allowed.has(plan.collection) || !Array.isArray(plan.pipeline) || plan.pipeline.length > 12)) throw new Error("Invalid aggregation batch");
    const database = await this.db();
    const maxTimeMS = options.maxTimeMS ?? 3_000;
    return Promise.all(plans.map(async (plan) => {
      const startedAt = Date.now();
      const result = await database.collection<RecordDoc>(plan.collection).aggregate(plan.pipeline, { maxTimeMS }).toArray() as RecordDoc[];
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 1_000) logOperational("mongo_query_slow", { collection: plan.collection, operation: "aggregate_batch", duration_ms: durationMs, result_count: result.length });
      return result;
    }));
  }

  async closeSession(sessionId: string, professionalId: string, status: "completed" | "no_show"): Promise<boolean> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
        const timestamp = new Date().toISOString();
        const update = status === "completed" ? { status, completed_at: timestamp } : { status, no_show_at: timestamp };
        const changed = await database.collection<RecordDoc>("sessions").updateOne({ id: sessionId, professional_id: professionalId, status: "scheduled" }, { $set: update }, { session });
        if (!changed.modifiedCount) return false;
        const current = await database.collection<RecordDoc>("sessions").findOne({ id: sessionId }, { projection: { request_id: 1, appointment_request_id: 1 }, session });
        if (current?.request_id) await database.collection<RecordDoc>("requests").updateOne({ id: current.request_id }, { $set: { status } }, { session });
        if (current?.appointment_request_id) await database.collection<RecordDoc>("appointment_requests").updateOne({ id: current.appointment_request_id }, { $set: { status, ...(status === "completed" ? { completed_at: timestamp } : { no_show_at: timestamp }) } }, { session });
        return true;
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Accepts a published request and creates its session atomically. */
  async acceptPublishedRequest(requestId: string, professionalId: string, appointment: RecordDoc): Promise<"accepted" | "changed"> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const changed = await database.collection<RecordDoc>("requests").updateOne(
            { id: requestId, professional_id: professionalId, status: "pending" },
            { $set: { status: "accepted", responded_at: new Date().toISOString() } },
            { session },
          );
          if (!changed.modifiedCount) return "changed";
          await database.collection<RecordDoc>("sessions").insertOne(appointment, { session });
          return "accepted";
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Declines a published request and releases its reserved availability atomically. */
  async declinePublishedRequest(requestId: string, professionalId: string, availabilityId?: string): Promise<boolean> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const changed = await database.collection<RecordDoc>("requests").updateOne(
            { id: requestId, professional_id: professionalId, status: "pending" },
            { $set: { status: "declined", responded_at: new Date().toISOString() } },
            { session },
          );
          if (!changed.modifiedCount) return false;
          if (availabilityId) await database.collection<RecordDoc>("availability").updateOne({ id: availabilityId, professional_id: professionalId, status: "reserved" }, { $set: { status: "open" } }, { session });
          return true;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Cancels a direct request and releases its reserved slot atomically. */
  async cancelAppointmentRequest(requestId: string, studentId: string, professionalId: string, availabilityId?: string): Promise<boolean> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const changed = await database.collection<RecordDoc>("appointment_requests").updateOne(
            { id: requestId, student_id: studentId, status: { $in: ["pending", "proposed"] } },
            { $set: { status: "cancelled", cancelled_at: new Date().toISOString() } },
            { session },
          );
          if (!changed.modifiedCount) return false;
          if (availabilityId) await database.collection<RecordDoc>("availability").updateOne({ id: availabilityId, professional_id: professionalId, status: "reserved" }, { $set: { status: "open" } }, { session });
          return true;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Declines a direct request and releases a proposed published slot atomically. */
  async declineAppointmentRequest(requestId: string, professionalId: string, availabilityId?: string): Promise<boolean> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const changed = await database.collection<RecordDoc>("appointment_requests").updateOne(
            { id: requestId, professional_id: professionalId, status: { $in: ["pending", "proposed"] } },
            { $set: { status: "declined", declined_at: new Date().toISOString(), responded_at: new Date().toISOString() } },
            { session },
          );
          if (!changed.modifiedCount) return false;
          if (availabilityId) await database.collection<RecordDoc>("availability").updateOne({ id: availabilityId, professional_id: professionalId, status: "reserved" }, { $set: { status: "open" } }, { session });
          return true;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Expires a legacy pending request and releases its slot atomically. */
  async expirePublishedRequest(requestId: string, professionalId: string, availabilityId?: string): Promise<boolean> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const changed = await database.collection<RecordDoc>("requests").updateOne(
            { id: requestId, professional_id: professionalId, status: "pending" },
            { $set: { status: "expired", expired_at: new Date().toISOString() } },
            { session },
          );
          if (!changed.modifiedCount) return false;
          if (availabilityId) await database.collection<RecordDoc>("availability").updateOne({ id: availabilityId, professional_id: professionalId, status: "reserved" }, { $set: { status: "open" } }, { session });
          return true;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Expires a direct request and releases its proposed capacity atomically. */
  async expireAppointmentRequest(requestId: string, professionalId: string, availabilityId?: string): Promise<boolean> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const changed = await database.collection<RecordDoc>("appointment_requests").updateOne(
            { id: requestId, professional_id: professionalId, status: "pending" },
            { $set: { status: "expired", expired_at: new Date().toISOString(), responded_at: new Date().toISOString() } },
            { session },
          );
          if (!changed.modifiedCount) return false;
          if (availabilityId) await database.collection<RecordDoc>("availability").updateOne({ id: availabilityId, professional_id: professionalId, status: "reserved" }, { $set: { status: "open" } }, { session });
          return true;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Cancels a legacy request, releases capacity, and removes its scheduled session atomically. */
  async cancelPublishedRequest(requestId: string, studentId: string, professionalId: string, availabilityId?: string): Promise<boolean> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const changed = await database.collection<RecordDoc>("requests").updateOne(
            { id: requestId, student_id: studentId, status: { $in: ["pending", "accepted"] } },
            { $set: { status: "cancelled", cancelled_at: new Date().toISOString() } },
            { session },
          );
          if (!changed.modifiedCount) return false;
          if (availabilityId) await database.collection<RecordDoc>("availability").updateOne({ id: availabilityId, professional_id: professionalId, status: "reserved" }, { $set: { status: "open" } }, { session });
          await database.collection<RecordDoc>("sessions").deleteMany({ request_id: requestId, status: "scheduled" }, { session });
          return true;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Keeps the legacy request and its session room link in sync. */
  async saveRoomLink(requestId: string, professionalId: string, sessionId: string | undefined, roomLink: string): Promise<boolean> {
    const database = await this.db();
    const session = this.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const changed = await database.collection<RecordDoc>("requests").updateOne({ id: requestId, professional_id: professionalId, status: "accepted" }, { $set: { room_link: roomLink } }, { session });
        if (!changed.matchedCount) return false;
        if (sessionId) await database.collection<RecordDoc>("sessions").updateOne({ id: sessionId, professional_id: professionalId, status: "scheduled" }, { $set: { room_link: roomLink } }, { session });
        return true;
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } finally { await session.endSession(); }
  }

  /** Updates a scheduled session and its legacy request in one transaction. */
  async saveSessionRoomLink(sessionId: string, professionalId: string, requestId: string | undefined, roomLink: string): Promise<boolean> {
    const database = await this.db();
    const session = this.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const changed = await database.collection<RecordDoc>("sessions").updateOne({ id: sessionId, professional_id: professionalId, status: "scheduled" }, { $set: { room_link: roomLink } }, { session });
        if (!changed.matchedCount) return false;
        if (requestId && !String(requestId).startsWith("appointment:")) await database.collection<RecordDoc>("requests").updateOne({ id: requestId, professional_id: professionalId }, { $set: { room_link: roomLink } }, { session });
        return true;
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } finally { await session.endSession(); }
  }

  /** Makes referral writes idempotent per conversation. */
  async saveReferral(sessionId: string, referral: RecordDoc): Promise<{ record: RecordDoc; changed: boolean }> {
    return this.withAuthLock(`referral:${sessionId}`, async () => {
      const existing = await this.findOne("referrals", { session_id: sessionId });
      if (existing) {
        const changed = existing.status !== referral.status || (existing.note || null) !== (referral.note || null);
        await this.update("referrals", { session_id: sessionId }, { $set: { status: referral.status, note: referral.note, updated_at: new Date().toISOString() } });
        return { record: { ...existing, status: referral.status, note: referral.note }, changed };
      }
      await this.insert("referrals", referral);
      return { record: referral, changed: true };
    });
  }

  async distinct(collection: string, field: string, filter: Filter<RecordDoc> = {}): Promise<string[]> {
    return (await (await this.collection(collection)).distinct(field, filter)).map(String);
  }

  async findOneAndUpdate(collection: string, filter: Filter<RecordDoc>, update: Document, projection?: Record<string, 0 | 1>): Promise<RecordDoc | null> {
    return (await (await this.collection(collection)).findOneAndUpdate(filter, update, {
      projection: { _id: 0, ...projection }, returnDocument: "before",
    })) as RecordDoc | null;
  }

  /** Atomically claims one notification for an e-mail delivery attempt. */
  async claimNotificationEmail(notificationId: string, nowIso: string, staleClaimIso: string): Promise<RecordDoc | null> {
    return this.findOneAndUpdate("notifications", {
      id: notificationId,
      $or: [
        { "email_delivery.status": "pending", "email_delivery.next_attempt_at": { $lte: nowIso } },
        { "email_delivery.status": "sending", "email_delivery.claimed_at": { $lt: staleClaimIso } },
      ],
    }, { $set: { "email_delivery.status": "sending", "email_delivery.claimed_at": nowIso }, $inc: { "email_delivery.attempts": 1 } });
  }

  /** Reserve capacity and record the direct proposal in one Atlas transaction. */
  async proposeDirectAppointment(requestId: string, slot: RecordDoc): Promise<"proposed" | "conflict" | "changed"> {
    return this.withCapacityLock(String(slot.professional_id), async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const duration = durationMinutes(slot);
          // MongoDB transactions do not support parallel operations on one
          // session; keep the reads serial inside the transaction.
          const availability = await database.collection<RecordDoc>("availability").find({ professional_id: slot.professional_id, date: slot.date, status: { $in: ["open", "reserved"] } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const sessions = await database.collection<RecordDoc>("sessions").find({ professional_id: slot.professional_id, date: slot.date, status: "scheduled" }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const proposals = await database.collection<RecordDoc>("appointment_requests").find({ professional_id: slot.professional_id, date: slot.date, status: { $in: ["proposed", "accepted"] } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          if ([...availability, ...sessions, ...proposals].some(record => overlaps(String(slot.date), String(slot.time), duration, record))) return "conflict";
          const timestamp = new Date().toISOString();
          const updated = await database.collection<RecordDoc>("appointment_requests").updateOne(
            { id: requestId, professional_id: slot.professional_id, status: "pending" },
            { $set: { status: "proposed", availability_id: slot.id, date: slot.date, time: slot.time, duration_minutes: duration, meeting_location: slot.location || null, proposed_at: timestamp, responded_at: timestamp } },
            { session },
          );
          if (!updated.modifiedCount) return "changed";
          await database.collection<RecordDoc>("availability").insertOne(slot, { session });
          return "proposed";
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Confirm the proposal and create its session without an intermediate state. */
  async confirmDirectAppointment(requestId: string, studentId: string, appointment: RecordDoc, professionalId?: string): Promise<boolean> {
    return this.withCapacityLock(String(professionalId || appointment.professional_id), async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const updated = await database.collection<RecordDoc>("appointment_requests").updateOne(
            { id: requestId, student_id: studentId, status: "proposed" },
            { $set: { status: "accepted", confirmed_at: new Date().toISOString() } },
            { session },
          );
          if (!updated.modifiedCount) return false;
          await database.collection<RecordDoc>("sessions").insertOne(appointment, { session });
          return true;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Claims an already published slot after rechecking all overlapping capacity. */
  async reservePublishedCapacity(slotId: string, professionalId: string): Promise<boolean> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const slots = database.collection<RecordDoc>("availability");
          const slot = await slots.findOne({ id: slotId, professional_id: professionalId, status: "open" }, { projection: { _id: 0 }, session });
          if (!slot) return false;
          const duration = durationMinutes(slot);
          const availability = await slots.find({ professional_id: professionalId, date: slot.date, status: { $in: ["open", "reserved"] }, id: { $ne: slotId } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const sessions = await database.collection<RecordDoc>("sessions").find({ professional_id: professionalId, date: slot.date, status: "scheduled" }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const proposals = await database.collection<RecordDoc>("appointment_requests").find({ professional_id: professionalId, date: slot.date, status: { $in: ["proposed", "accepted"] }, availability_id: { $ne: slotId } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          if ([...availability, ...sessions, ...proposals].some(record => overlaps(String(slot.date), String(slot.time), duration, record))) return false;
          return (await slots.updateOne({ id: slotId, professional_id: professionalId, status: "open" }, { $set: { status: "reserved" } }, { session })).modifiedCount === 1;
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Deletes an open slot under the same capacity lock used by reservations. */
  async deleteAvailability(slotId: string, professionalId: string): Promise<"deleted" | "reserved" | "missing"> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const slot = await database.collection<RecordDoc>("availability").findOne({ id: slotId, professional_id: professionalId }, { projection: { _id: 0, status: 1 } });
      if (!slot) return "missing";
      if (slot.status !== "open") return "reserved";
      const result = await database.collection<RecordDoc>("availability").deleteOne({ id: slotId, professional_id: professionalId, status: "open" });
      return result.deletedCount === 1 ? "deleted" : "reserved";
    });
  }

  /** Reserves a published slot and advances a direct request atomically. */
  async proposePublishedAppointment(requestId: string, professionalId: string, slotId: string): Promise<"proposed" | "conflict" | "changed"> {
    return this.withCapacityLock(professionalId, async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const requests = database.collection<RecordDoc>("appointment_requests");
          const current = await requests.findOne({ id: requestId, professional_id: professionalId, status: "pending" }, { projection: { _id: 0 }, session });
          if (!current) return "changed";
          const slots = database.collection<RecordDoc>("availability");
          const slot = await slots.findOne({ id: slotId, professional_id: professionalId, status: "open" }, { projection: { _id: 0 }, session });
          if (!slot) return "conflict";
          const duration = durationMinutes(slot);
          const availability = await slots.find({ professional_id: professionalId, date: slot.date, status: { $in: ["open", "reserved"] }, id: { $ne: slotId } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const sessions = await database.collection<RecordDoc>("sessions").find({ professional_id: professionalId, date: slot.date, status: "scheduled" }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const proposals = await requests.find({ professional_id: professionalId, date: slot.date, status: { $in: ["proposed", "accepted"] }, id: { $ne: requestId } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          if ([...availability, ...sessions, ...proposals].some(record => overlaps(String(slot.date), String(slot.time), duration, record))) return "conflict";
          if (!(await slots.updateOne({ id: slotId, status: "open" }, { $set: { status: "reserved" } }, { session })).modifiedCount) return "conflict";
          const timestamp = new Date().toISOString();
          const updated = await requests.updateOne({ id: requestId, professional_id: professionalId, status: "pending" }, { $set: { status: "proposed", availability_id: slotId, date: slot.date, time: slot.time, duration_minutes: duration, meeting_location: slot.location || null, proposed_at: timestamp, responded_at: timestamp } }, { session });
          return updated.modifiedCount ? "proposed" : "changed";
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Atomically moves a legacy request to another published slot. */
  async reschedulePublishedRequest(requestId: string, studentId: string, oldSlotId: string | undefined, slot: RecordDoc, changes: RecordDoc, oldProfessionalId?: string): Promise<"rescheduled" | "conflict" | "changed"> {
    return this.withCapacityLocks([String(slot.professional_id), String(oldProfessionalId || slot.professional_id)], async () => {
      const database = await this.db();
      const session = this.client.startSession();
      try {
        return await session.withTransaction(async () => {
          const requests = database.collection<RecordDoc>("requests");
          const current = await requests.findOne({ id: requestId, student_id: studentId, status: { $in: ["pending", "accepted"] } }, { projection: { _id: 0, availability_id: 1 }, session });
          if (!current) return "changed";
          const slots = database.collection<RecordDoc>("availability");
          const target = await slots.findOne({ id: slot.id, professional_id: slot.professional_id, status: "open" }, { projection: { _id: 0 }, session });
          if (!target) return "conflict";
          const duration = durationMinutes(target);
          const availability = await slots.find({ professional_id: target.professional_id, date: target.date, status: { $in: ["open", "reserved"] }, id: { $ne: target.id } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const sessions = await database.collection<RecordDoc>("sessions").find({ professional_id: target.professional_id, date: target.date, status: "scheduled", request_id: { $ne: requestId } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          const proposals = await database.collection<RecordDoc>("appointment_requests").find({ professional_id: target.professional_id, date: target.date, status: { $in: ["proposed", "accepted"] } }, { projection: { _id: 0, date: 1, time: 1, duration_minutes: 1 }, session }).toArray();
          if ([...availability, ...sessions, ...proposals].some(record => overlaps(String(target.date), String(target.time), duration, record))) return "conflict";
          if (!(await slots.updateOne({ id: target.id, status: "open" }, { $set: { status: "reserved" } }, { session })).modifiedCount) return "conflict";
          const updated = await requests.updateOne({ id: requestId, student_id: studentId, status: { $in: ["pending", "accepted"] } }, { $set: { ...changes, availability_id: target.id, professional_id: target.professional_id, date: target.date, time: target.time, duration_minutes: duration, status: "pending", rescheduled_at: new Date().toISOString() } }, { session });
          if (!updated.modifiedCount) return "changed";
          await database.collection<RecordDoc>("sessions").deleteMany({ request_id: requestId, status: "scheduled" }, { session });
          if (oldSlotId) await slots.updateOne({ id: oldSlotId, status: "reserved" }, { $set: { status: "open" } }, { session });
          return "rescheduled";
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally { await session.endSession(); }
    });
  }

  /** Approves a child account and its audit event in one Atlas transaction. */
  async approveMinorRegistration(userId: string, institutionId: string, actorId: string, validationMethod: string): Promise<boolean> {
    const database = await this.db();
    const session = this.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const result = await database.collection<RecordDoc>("users").updateOne(
          { id: userId, institution_id: institutionId, role: "student", age_band: "child", guardian_review_status: "pending_institution_review" },
          { $set: { active: true, guardian_review_status: "approved", guardian_reviewed_at: new Date().toISOString(), guardian_reviewed_by: actorId } },
          { session },
        );
        if (!result.modifiedCount) return false;
        await database.collection<RecordDoc>("events").insertOne({ id: crypto.randomUUID(), type: "minor_registration_approved", user_id: actorId, role: "institution", institution_id: institutionId, meta: { student_user_id: userId, validation_method: validationMethod }, created_at: new Date().toISOString() }, { session });
        return true;
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } finally { await session.endSession(); }
  }
}

export type Mongo = Pick<MongoGateway, "ping" | "findOne" | "findMany" | "insert" | "insertIfAbsent" | "update" | "recordAnalyticsPageView" | "allowChatMessage" | "updateMany" | "remove" | "deleteAccount" | "count" | "countMany" | "aggregate" | "aggregateMany" | "getStudentDashboard" | "getProfessionalDashboard" | "getInstitutionDashboard" | "getAdminSummary" | "distinct" | "findOneAndUpdate" | "claimNotificationEmail" | "proposeDirectAppointment" | "confirmDirectAppointment" | "reservePublishedCapacity" | "deleteAvailability" | "proposePublishedAppointment" | "reschedulePublishedRequest" | "approveMinorRegistration" | "createStudentRequest" | "createPublishedStudentRequest" | "issueCertificate" | "saveFeedback" | "createAvailabilityBatch" | "recordLoginFailure" | "finalizeLogin" | "savePasswordReset" | "createLead" | "createStudentAccount" | "createProfessionalInvite" | "createInstitution" | "approveInstitutionLead" | "closeSession" | "acceptPublishedRequest" | "declinePublishedRequest" | "cancelAppointmentRequest" | "declineAppointmentRequest" | "expirePublishedRequest" | "expireAppointmentRequest" | "cancelPublishedRequest" | "saveRoomLink" | "saveSessionRoomLink" | "saveReferral">;

export function gateway(env: Env): Mongo {
  const gatewayName = gatewayObjectName(env.APP_ENV);
  return env.MONGO_GATEWAY.get(env.MONGO_GATEWAY.idFromName(gatewayName)) as unknown as Mongo;
}
