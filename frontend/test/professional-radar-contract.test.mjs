import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/mvp/ProfessionalArea.jsx", import.meta.url), "utf8");
test("professional panel keeps the operational radar and safe manual drafts", () => {
  assert.match(source, /Radar de hoje/);
  assert.match(source, /response_overdue|due_soon/);
  assert.match(source, /professional-capacity-card/);
  assert.match(source, /availability_id/);
  assert.match(source, /professional-checklist/);
  assert.match(source, /Nada é enviado automaticamente/);
  assert.match(source, /professional-message-drafts-card/);
});

test("professional suggestions require explicit proposal action", () => {
  assert.match(source, /Propor horário/i);
  assert.doesNotMatch(source, /onClick=\{\(\) => api\.post\([^}]*appointment-requests/);
});
