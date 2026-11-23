import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "src", "runtime.ts"), "utf8");
const core = fs.readFileSync(path.join(root, "src", "core.ts"), "utf8");
const db = fs.readFileSync(path.join(root, "src", "db.ts"), "utf8");
const index = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");

test("runtime resolves isolated Durable Object names", () => {
  assert.match(runtime, /appEnv === "staging" \? "acolhe-staging-mongodb" : "acolhe-mongodb"/);
  assert.match(core, /gatewayObjectName\(env\.APP_ENV\)/);
  assert.match(db, /gatewayObjectName\(env\.APP_ENV\)/);
  assert.match(index, /idFromName\(gatewayObjectName\(env\.APP_ENV\)\)/);
  assert.doesNotMatch(index, /idFromName\("acolhe-mongodb"\)/);
});
