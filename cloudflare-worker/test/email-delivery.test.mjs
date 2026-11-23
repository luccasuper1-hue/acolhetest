import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const source = await readFile(resolve(import.meta.dirname, "../src/email-delivery.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleRef = { exports: {} };
new Function("module", "exports", compiled)(moduleRef, moduleRef.exports);
const { resolveEmailDelivery } = moduleRef.exports;

test("provider failure schedules bounded exponential retry", () => {
  const decision = resolveEmailDelivery(2, false, true, Date.parse("2026-11-20T12:00:00.000Z"));
  assert.equal(decision.status, "pending");
  assert.equal(decision.failure, "provider_unavailable");
  assert.equal(decision.next_attempt_at, "2026-11-20T12:04:00.000Z");
});

test("successful delivery clears retry state", () => {
  assert.deepEqual(resolveEmailDelivery(2, true, true, Date.parse("2026-11-20T12:00:00.000Z")), { status: "sent" });
});

test("missing recipient and retry exhaustion become terminal failures", () => {
  assert.deepEqual(resolveEmailDelivery(1, false, false), { status: "failed", failure: "missing_recipient_email" });
  assert.deepEqual(resolveEmailDelivery(5, false, true), { status: "failed", failure: "retry_limit_reached" });
});
