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

test("REST chat rate limit is scoped per user and session", () => {
  const gateway = Object.create(MongoGateway.prototype);
  gateway.chatWindows = new Map();
  gateway.chatCleanupAt = 0;
  for (let index = 0; index < 30; index += 1) assert.deepEqual(gateway.allowChatMessage("u1", "s1"), { allowed: true, retryAfterSeconds: 0 });
  const limited = gateway.allowChatMessage("u1", "s1");
  assert.equal(limited.allowed, false);
  assert.ok(limited.retryAfterSeconds >= 1 && limited.retryAfterSeconds <= 60);
  assert.deepEqual(gateway.allowChatMessage("u1", "s2"), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(gateway.allowChatMessage("u2", "s1"), { allowed: true, retryAfterSeconds: 0 });
});

test("chat rate-limit state expires and does not grow without bound", () => {
  const gateway = Object.create(MongoGateway.prototype);
  gateway.chatWindows = new Map([["old", { startedAt: 0, count: 30 }]]);
  gateway.chatCleanupAt = 0;
  const originalNow = Date.now;
  Date.now = () => 61_000;
  try {
    assert.deepEqual(gateway.allowChatMessage("u1", "s1"), { allowed: true, retryAfterSeconds: 0 });
    assert.equal(gateway.chatWindows.has("old"), false);
    assert.equal(gateway.chatWindows.size, 1);
  } finally {
    Date.now = originalNow;
  }
});
