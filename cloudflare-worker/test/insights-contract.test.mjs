import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../src/", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");
const [assistant, policy, tools, provider, schemas, routes, index, wrangler, fallback, prompts] = await Promise.all(["ai/assistant.ts", "ai/policy.ts", "ai/tools.ts", "ai/provider.ts", "ai/schemas.ts", "routes.ts", "index.ts", "../wrangler.jsonc", "ai/fallback.ts", "ai/prompts.ts"].map(read));

test("Acolhe Insights is institution-scoped and Workers AI-only", () => {
  assert.match(routes, /\/api\/institutions\/me\/insights/);
  assert.match(assistant, /consumeInsightQuota/);
  assert.match(assistant, /fallbackInsight/);
  assert.match(provider, /env\.AI/);
  assert.doesNotMatch(provider, /openai|gemini|anthropic/i);
  assert.match(index, /AI\?:/);
  assert.match(wrangler, /"ai"\s*:\s*\{\s*"binding"\s*:\s*"AI"/);
  assert.match(tools, /capacity|attendance|response/);
  assert.match(schemas, /Resposta sem fontes/);
  assert.match(policy, /diagn[oó]stico|conversa/i);
  assert.match(policy, /minuteCount|fingerprints/);
  assert.match(policy, /12 meses/);
  assert.match(fallback, /confidence: "fallback"/);
  assert.match(prompts, /orientador institucional cuidadoso/);
  assert.match(prompts, /observation|observado/);
  assert.match(prompts, /next_step/);
});

test("adversarial and source integrity protections are present", () => {
  assert.match(policy, /ignore|desconsidere/i);
  assert.match(policy, /e-?mail|nome|dado bruto/i);
  assert.match(schemas, /Número sem fonte|Fonte inexistente/);
  assert.match(schemas, /sample_size/);
  assert.match(assistant, /15_000/);
  assert.match(schemas, /observation/);
  assert.match(schemas, /interpretation/);
  assert.match(schemas, /next_step/);
});

test("Insights never logs the complete question or answer", () => {
  assert.doesNotMatch(assistant, /logOperational\([^\n]*(question|answer)/i);
  assert.match(assistant, /institution_scope/);
});
