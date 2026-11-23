import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

test("natural Portuguese questions map to safe intents and clarifications", async () => {
  const directory = await mkdtemp(join(tmpdir(), "acolhe-policy-"));
  try {
    const policySource = await readFile(new URL("../src/ai/policy.ts", import.meta.url), "utf8");
    const schemaSource = await readFile(new URL("../src/ai/schemas.ts", import.meta.url), "utf8");
    const compile = (source, name) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from "\.\/schemas";/, `from "./schemas.mjs";`);
    await writeFile(join(directory, "schemas.mjs"), ts.transpileModule(schemaSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, "utf8");
    await writeFile(join(directory, "policy.mjs"), compile(policySource, "policy"), "utf8");
    const { inspectQuestion } = await import(`${pathToFileURL(join(directory, "policy.mjs")).href}?test=${Date.now()}`);
    assert.equal(inspectQuestion("A demanda aumentou?").intent, "demand");
    assert.equal(inspectQuestion("Estamos respondendo em até 48 horas?").intent, "response_time");
    assert.equal(inspectQuestion("Como está o comparecimento?").intent, "attendance");
    assert.equal(inspectQuestion("Temos capacidade para abrir mais horários?").intent, "capacity");
    assert.equal(inspectQuestion("Onde está o principal gargalo?").intent, "bottlenecks");
    assert.equal(inspectQuestion("Oi").intent, "conversation");
    assert.equal(inspectQuestion("oitdd bem").intent, "conversation");
    assert.equal(inspectQuestion("Vale a pena usar o Acolhe?").intent, "overview");
    assert.equal(inspectQuestion("Me explica esse site do seu jeito").intent, "general_scope");
assert.equal(inspectQuestion("pra q alguém usaria o acolhe?").intent, "product_help");
    assert.equal(inspectQuestion("Demanda e capacidade estão equilibradas?").intent, "clarification");
    assert.equal(inspectQuestion("Como evoluiu nos últimos 24 meses?").intent, "period_limit");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
