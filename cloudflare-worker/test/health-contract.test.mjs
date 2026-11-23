import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(import.meta.dirname, "../src/index.ts"), "utf8");

test("health endpoints distinguish liveness from database readiness", () => {
  assert.match(source, /\["\/api\/live", "\/api\/ready", "\/api\/health"\]/);
  assert.match(source, /url\.pathname === "\/api\/live"/);
  assert.match(source, /await db\(env\)\.ping\(\)/);
  assert.match(source, /ready \? 200 : 503/);
  assert.match(source, /cache-control.*no-store/);
});
