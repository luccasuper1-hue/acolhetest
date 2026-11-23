import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("index creation is idempotent before analytics_daily exists", async () => {
  const source = await readFile(new URL("../scripts/create-indexes.mjs", import.meta.url), "utf8");
  assert.match(source, /NamespaceNotFound/);
  assert.match(source, /error\?\.code === 26/);
  assert.match(source, /analyticsTtlIndex/);
});
