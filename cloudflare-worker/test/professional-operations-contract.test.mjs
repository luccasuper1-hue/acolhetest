import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routes = await readFile(new URL("../src/routes.ts", import.meta.url), "utf8");

test("professional dashboard returns a deterministic, bounded operational radar", () => {
  assert.match(routes, /const professionalRadar/);
  assert.match(routes, /pending_request|today_session|missing_room_link|pending_referral|open_capacity|capacity_conflict/);
  assert.match(routes, /return items\.slice\(0, 30\)/);
  assert.match(routes, /professionalRadar\(\{ requests, appointmentRequests, sessions, availability, referrals \}\)/);
  assert.match(routes, /radar, metrics/);
  assert.doesNotMatch(routes, /session_messages.*professionalRadar/);
});

test("professional metrics suppress small samples and ignore invalid response times", () => {
  assert.match(routes, /const professionalMetrics/);
  assert.match(routes, /responseMinutes\.filter\(value => value <= 2_880\)/);
  assert.match(routes, /responseMinutes\.length >= 5/);
  assert.match(routes, /closed >= 5/);
  assert.match(routes, /minutes >= 0/);
});
