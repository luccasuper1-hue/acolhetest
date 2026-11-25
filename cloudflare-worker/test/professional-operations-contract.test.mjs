import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = await readFile(new URL("../src/routes.ts", import.meta.url), "utf8");

test("professional dashboard omits the retired radar and keeps metrics", () => {
  assert.doesNotMatch(routes, /professionalRadar|radar, metrics/);
  assert.match(routes, /professionalMetrics/);
});

test("professional metrics suppress small samples and ignore invalid response times", () => {
  assert.match(routes, /const professionalMetrics/);
  assert.match(routes, /responseMinutes\.filter\(value => value <= 2_880\)/);
  assert.match(routes, /responseMinutes\.length >= 5/);
  assert.match(routes, /closed >= 5/);
  assert.match(routes, /minutes >= 0/);
});
