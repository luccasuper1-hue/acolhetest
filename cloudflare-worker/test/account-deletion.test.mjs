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

function fixture(role = "student", failCollection) {
  const profileCollection = role === "student" ? "students" : "professionals";
  const profileField = role === "student" ? "student_id" : "professional_id";
  let rows = {
    users: [{ id: "u1", role, email: "a@example.test", institution_id: "i1" }, { id: "u2", role: "student" }],
    students: role === "student" ? [{ id: "p1", user_id: "u1" }] : [],
    professionals: role === "professional" ? [{ id: "p1", user_id: "u1" }] : [],
    sessions: role === "institution" ? [] : [{ id: "s1", [profileField]: "p1" }],
    referrals: [{ session_id: "s1" }], feedback: [{ session_id: "s1" }],
    session_messages: [{ session_id: "s1", sender_user_id: "u1" }],
    availability: [{ professional_id: "p1" }],
    availability_interests: [{ [profileField]: "p1" }],
    appointment_requests: [{ [profileField]: "p1" }],
    requests: [{ [profileField]: "p1" }],
    notifications: [{ recipient_user_id: "u1" }, { recipient_user_id: "u2" }],
    password_reset_tokens: [{ user_id: "u1" }],
    login_attempts: [{ identifier: "a@example.test" }],
    events: [{ user_id: "u1", type: "login" }],
    certificates: [{ user_id: "u1", code: "AC-TEST" }],
  };
  let failed = false;
  let ended = false;
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) =>
    value && typeof value === "object" && "$in" in value
      ? value.$in.includes(row[key]) : row[key] === value);
  const collection = name => ({
    async findOne(filter, options) {
      assert.ok(options?.session);
      return rows[name].find(row => matches(row, filter)) || null;
    },
    find(filter, options) {
      assert.ok(options?.session);
      return { toArray: async () => rows[name].filter(row => matches(row, filter)).map(row => ({ id: row.id })) };
    },
    async deleteMany(filter, options) {
      assert.ok(options?.session);
      if (name === failCollection && !failed) { failed = true; throw new Error("temporary failure"); }
      rows[name] = rows[name].filter(row => !matches(row, filter));
    },
    async deleteOne(filter, options) {
      assert.ok(options?.session);
      rows[name] = rows[name].filter(row => !matches(row, filter));
    },
    async updateMany(filter, update, options) {
      assert.ok(options?.session);
      for (const row of rows[name]) if (matches(row, filter)) Object.assign(row, update.$set);
    },
    async insertOne(value, options) {
      assert.ok(options?.session);
      if (name === failCollection && !failed) { failed = true; throw new Error("temporary failure"); }
      rows[name].push(value);
    },
  });
  const gateway = Object.create(MongoGateway.prototype);
  gateway.db = async () => ({ collection });
  gateway.client = { startSession: () => ({
    withTransaction: async action => {
      const before = structuredClone(rows);
      try { return await action(); }
      catch (error) { rows = before; throw error; }
    },
    endSession: async () => { ended = true; },
  }) };
  return { gateway, get rows() { return rows; }, get ended() { return ended; }, profileCollection };
}

for (const role of ["student", "professional", "institution"]) {
  test(`${role} deletion commits all dependent records together`, async () => {
    const state = fixture(role);
    assert.deepEqual(await state.gateway.deleteAccount("u1", { kind: "self" }), { id: "u1", role, institution_id: "i1" });
    assert.deepEqual(state.rows.users.map(row => row.id), ["u2"]);
    assert.equal(state.rows[state.profileCollection].length, 0);
    assert.deepEqual(state.rows.notifications.map(row => row.recipient_user_id), ["u2"]);
    assert.equal(state.rows.password_reset_tokens.length, 0);
    assert.equal(state.rows.login_attempts.length, 0);
    assert.equal(state.rows.events[0].user_id, null);
    assert.equal(state.rows.events[1].type, "user_deleted_self");
    assert.equal(state.rows.events[1].user_id, "system");
    assert.equal(state.rows.certificates.length, 1);
    if (role !== "institution") {
      for (const name of ["sessions", "referrals", "feedback", "session_messages", "availability_interests", "appointment_requests", "requests"])
        assert.equal(state.rows[name].length, 0, name);
      assert.equal(state.rows.availability.length, role === "professional" ? 0 : 1);
    }
    assert.equal(state.ended, true);
  });
}

test("a failed dependent deletion rolls back the account and every earlier deletion", async () => {
  const state = fixture("student", "feedback");
  const original = structuredClone(state.rows);
  await assert.rejects(state.gateway.deleteAccount("u1", { kind: "self" }), /temporary failure/);
  assert.deepEqual(state.rows, original);
  assert.equal(state.ended, true);
  assert.equal((await state.gateway.deleteAccount("u1", { kind: "self" })).id, "u1");
  assert.equal(state.rows.users.some(row => row.id === "u1"), false);
});

test("an audit write failure also rolls back the deletion", async () => {
  const state = fixture("professional", "events");
  const original = structuredClone(state.rows);
  await assert.rejects(state.gateway.deleteAccount("u1", { kind: "admin", adminId: "admin-1" }), /temporary failure/);
  assert.deepEqual(state.rows, original);
});

test("administrator deletion records the actor in the same transaction", async () => {
  const state = fixture("student");
  await state.gateway.deleteAccount("u1", { kind: "admin", adminId: "admin-1" });
  assert.equal(state.rows.events[1].type, "user_deleted");
  assert.equal(state.rows.events[1].user_id, "admin-1");
  assert.equal(state.rows.events[1].meta.target, "u1");
});

test("administrators cannot be deleted through the shared gateway", async () => {
  const state = fixture();
  state.rows.users[0].role = "admin";
  assert.equal(await state.gateway.deleteAccount("u1", { kind: "admin", adminId: "admin-1" }), null);
  assert.equal(state.rows.users.length, 2);
});
