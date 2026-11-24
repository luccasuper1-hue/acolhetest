import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("AI bindings, routes and implementation are absent", () => {
  const routes = read("src/routes.ts");
  const index = read("src/index.ts");
  const production = read("wrangler.jsonc");
  const staging = read("wrangler.staging.jsonc");

  assert.doesNotMatch(routes, /\/api\/(?:institutions|professionals)\/me\/insights/);
  assert.doesNotMatch(routes, /handle(?:Institution|Professional)Insight|\.\/ai\//);
  assert.doesNotMatch(index, /\bAI\b|Workers AI/);
  assert.doesNotMatch(production, /"ai"|\bAI\b/);
  assert.doesNotMatch(staging, /"ai"|\bAI\b/);
  const aiDir = path.join(root, "src/ai");
  assert.equal(fs.existsSync(aiDir) ? fs.readdirSync(aiDir).length : 0, 0);
});

test("deterministic operational metrics and radar remain available", () => {
  const routes = read("src/routes.ts");
  assert.match(routes, /professionalRadar/);
  assert.match(routes, /professionalMetrics/);
  assert.match(routes, /institutionMetrics/);
  assert.match(routes, /\/api\/institutions\/me\/metrics/);
});
