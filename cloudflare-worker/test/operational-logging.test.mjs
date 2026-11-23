import test from "node:test";
import assert from "node:assert/strict";
import { operationalRoute, sanitizeOperationalFields } from "../src/domains/operations.ts";

test("operational route labels exclude certificate codes, invite tokens and account IDs", () => {
  assert.equal(operationalRoute("/api/certificates/AC-2026-PRIVATE"), "/api/certificates/:code");
  assert.equal(operationalRoute("/api/auth/invite/secret-token/accept"), "/api/auth/invite");
  assert.equal(operationalRoute("/api/students/me/sessions/private-session/messages"), "/api/students/me/sessions");
  assert.equal(operationalRoute("/api/admin/users/person@example.test"), "/api/admin/users");
  assert.equal(operationalRoute("/api/auth/person@example.test"), "/api/auth/other");
});

test("operational fields cannot log identifiers through the route field", () => {
  const fields = sanitizeOperationalFields({
    route: "/api/auth/invite/secret-token/accept",
    token: "secret-token",
    user_id: "person-id",
    status: 403,
  });
  assert.deepEqual(fields, { route: "/api/auth/invite", status: 403 });
  assert.doesNotMatch(JSON.stringify(fields), /secret-token|person-id/);
});
