import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/mvp/InstitutionArea.jsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/mvp/api.js", import.meta.url), "utf8");
test("institution panel exposes non-blocking Acolhe Insights", () => {
  assert.match(source, /Acolhe Insights/);
  assert.match(source, /institutions\/me\/insights/);
  assert.match(source, /AbortController/);
  assert.match(source, /Como está nossa demanda/);
  assert.match(source, /fontes agregadas|Fontes agregadas/);
  assert.match(api, /timeout: 15_000/);
});
