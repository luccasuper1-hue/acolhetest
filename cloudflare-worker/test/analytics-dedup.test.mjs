import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const db = fs.readFileSync(new URL("../src/db.ts", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../src/routes.ts", import.meta.url), "utf8");

test("public analytics deduplicates page views by visitor, page and day", () => {
  assert.match(db, /recordAnalyticsPageView\(day: string, visitorHash: string, pageKey: string, increments: RecordDoc, rateKey: string/);
  assert.match(db, /page_view_keys/);
  assert.match(db, /pageViewKeys\.includes\(pageKey\)/);
  assert.match(db, /analyticsWindows/);
assert.match(db, /analyticsCleanupAt/);
  assert.match(db, /window\.count > 120/);
  assert.match(db, /MAX_ANALYTICS_KEYS_PER_DAY = 100_000/);
  assert.match(routes, /CF-Connecting-IP/);
  assert.match(routes, /recordAnalyticsPageView\(localToday\(\), visitorHash, pageKey, increments, rateKey\)/);
assert.match(routes, /consent_version.*measurement_consent/);
});
