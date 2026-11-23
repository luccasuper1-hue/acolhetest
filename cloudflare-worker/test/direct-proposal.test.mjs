import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const source = await readFile(resolve(import.meta.dirname, "../src/db.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRef = { exports: {} };
new Function("require", "module", "exports", compiled)(
  name => name === "cloudflare:workers" ? { DurableObject: class {} } : { MongoClient: class {} },
  moduleRef,
  moduleRef.exports,
);
const { MongoGateway } = moduleRef.exports;

function fixture({ failInsert = false } = {}) {
  let rows = {
    requests: [],
    appointment_requests: [
      { id: "r1", professional_id: "p1", status: "pending" },
      { id: "r2", professional_id: "p1", status: "pending" },
    ],
    availability: [],
    sessions: [],
  };
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === "object" && "$in" in value) return value.$in.includes(row[key]);
    if (value && typeof value === "object" && "$ne" in value) return row[key] !== value.$ne;
    return row[key] === value;
  });
  const collection = name => ({
    async findOne(filter, options) {
      assert.ok(options?.session);
      return rows[name].find(row => matches(row, filter)) || null;
    },
    find(filter, options) {
      assert.ok(options?.session);
      return { toArray: async () => {
        await Promise.resolve();
        return rows[name].filter(row => matches(row, filter));
      } };
    },
    async updateOne(filter, update, options) {
      assert.ok(options?.session);
      const record = rows[name].find(row => matches(row, filter));
      if (!record) return { modifiedCount: 0 };
      Object.assign(record, update.$set);
      return { modifiedCount: 1 };
    },
    async insertOne(value, options) {
      assert.ok(options?.session);
      if (failInsert) throw new Error("insert failed");
      rows[name].push(value);
    },
    async deleteMany(filter, options) {
      assert.ok(options?.session);
      rows[name] = rows[name].filter(row => !matches(row, filter));
    },
  });
  const gateway = Object.create(MongoGateway.prototype);
  gateway.capacityLocks = new Map();
  gateway.db = async () => ({ collection });
  gateway.client = { startSession: () => ({
    withTransaction: async action => {
      const before = structuredClone(rows);
      try { return await action(); }
      catch (error) { rows = before; throw error; }
    },
    endSession: async () => {},
  }) };
  const slot = (id, time) => ({ id, professional_id: "p1", date: "2026-11-20", time, duration_minutes: 30, status: "reserved" });
  return { gateway, slot, get rows() { return rows; } };
}

test("direct proposal commits the request and capacity together", async () => {
  const state = fixture();
  assert.equal(await state.gateway.proposeDirectAppointment("r1", state.slot("s1", "14:00")), "proposed");
  assert.equal(state.rows.appointment_requests[0].status, "proposed");
  assert.equal(state.rows.appointment_requests[0].availability_id, "s1");
  assert.equal(state.rows.availability.length, 1);
});

test("overlapping concurrent proposals cannot reserve the same professional", async () => {
  const state = fixture();
  const outcomes = await Promise.all([
    state.gateway.proposeDirectAppointment("r1", state.slot("s1", "14:00")),
    state.gateway.proposeDirectAppointment("r2", state.slot("s2", "14:15")),
  ]);
  assert.deepEqual(outcomes, ["proposed", "conflict"]);
  assert.equal(state.rows.availability.length, 1);
  assert.equal(state.rows.appointment_requests[1].status, "pending");
});

test("capacity insertion failure rolls back the proposal", async () => {
  const state = fixture({ failInsert: true });
  await assert.rejects(state.gateway.proposeDirectAppointment("r1", state.slot("s1", "14:00")), /insert failed/);
  assert.equal(state.rows.appointment_requests[0].status, "pending");
  assert.equal(state.rows.availability.length, 0);
});

test("student confirmation commits the accepted request and scheduled session", async () => {
  const state = fixture();
  Object.assign(state.rows.appointment_requests[0], { status: "proposed", student_id: "student-1" });
  const appointment = { id: "meeting-1", appointment_request_id: "r1", professional_id: "p1", status: "scheduled" };
  assert.equal(await state.gateway.confirmDirectAppointment("r1", "student-1", appointment), true);
  assert.equal(state.rows.appointment_requests[0].status, "accepted");
  assert.deepEqual(state.rows.sessions, [appointment]);
});

test("failed session creation leaves the student's proposal unconfirmed", async () => {
  const state = fixture({ failInsert: true });
  Object.assign(state.rows.appointment_requests[0], { status: "proposed", student_id: "student-1" });
  await assert.rejects(state.gateway.confirmDirectAppointment("r1", "student-1", { id: "meeting-1", professional_id: "p1" }), /insert failed/);
  assert.equal(state.rows.appointment_requests[0].status, "proposed");
  assert.equal(state.rows.sessions.length, 0);
});

test("concurrent rematches reserve one target slot and release the old slot once", async () => {
  const state = fixture();
  state.rows.requests = [
    { id: "legacy-1", student_id: "student-1", professional_id: "p1", status: "accepted", availability_id: "old-1" },
    { id: "legacy-2", student_id: "student-2", professional_id: "p1", status: "accepted", availability_id: "old-2" },
  ];
  state.rows.availability = [
    { id: "old-1", professional_id: "p1", date: "2026-11-20", time: "14:00", duration_minutes: 30, status: "reserved" },
    { id: "old-2", professional_id: "p1", date: "2026-11-20", time: "14:30", duration_minutes: 30, status: "reserved" },
    { id: "target", professional_id: "p1", date: "2026-11-20", time: "15:00", duration_minutes: 30, status: "open" },
  ];
  const target = state.slot("target", "15:00");
  const outcomes = await Promise.all([
    state.gateway.reschedulePublishedRequest("legacy-1", "student-1", "old-1", target, {}),
    state.gateway.reschedulePublishedRequest("legacy-2", "student-2", "old-2", target, {}),
  ]);
  assert.deepEqual(outcomes.sort(), ["conflict", "rescheduled"]);
  assert.equal(state.rows.availability.find(row => row.id === "target").status, "reserved");
  assert.equal(state.rows.availability.find(row => row.id === "old-1").status, "open");
  assert.equal(state.rows.availability.find(row => row.id === "old-2").status, "reserved");
});

test("notification email claims are single-flight under concurrent retries", async () => {
  const gateway = Object.create(MongoGateway.prototype);
  let status = "pending";
  gateway.findOneAndUpdate = async (_collection, filter, update) => {
    assert.equal(filter.id, "notification-1");
    assert.ok(Array.isArray(filter.$or));
    if (status !== "pending") return null;
    status = update.$set["email_delivery.status"];
    return { id: "notification-1", email_delivery: { attempts: 0 } };
  };
  const claims = await Promise.all([
    gateway.claimNotificationEmail("notification-1", "2026-11-20T12:00:00.000Z", "2026-11-20T11:50:00.000Z"),
    gateway.claimNotificationEmail("notification-1", "2026-11-20T12:00:00.000Z", "2026-11-20T11:50:00.000Z"),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(status, "sending");
});

test("notification email claims can recover a stale sending record", async () => {
  const gateway = Object.create(MongoGateway.prototype);
  let status = "sending";
  gateway.findOneAndUpdate = async (_collection, filter, update) => {
    assert.equal(filter.id, "notification-stale");
    assert.ok(filter.$or.some(branch => branch["email_delivery.status"] === "sending"));
    if (status !== "sending") return null;
    status = update.$set["email_delivery.status"];
    return { id: "notification-stale", email_delivery: { attempts: 2 } };
  };
  const claim = await gateway.claimNotificationEmail("notification-stale", "2026-11-20T12:00:00.000Z", "2026-11-20T11:50:00.000Z");
  assert.ok(claim);
  assert.equal(status, "sending");
});
