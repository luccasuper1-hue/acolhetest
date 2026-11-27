import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/mvp/ProfessionalArea.jsx", import.meta.url), "utf8");
test("professional panel keeps operational flow without auxiliary cards", () => {
  assert.doesNotMatch(source, /Radar de hoje|serverRadar|computedRadarItems/);
  assert.match(source, /availability_id/);
  assert.match(source, /professional-checklist/);
  assert.doesNotMatch(source, /professional-capacity-card|professional-message-drafts-card|Rascunhos de mensagens práticas/);
});

test("professional suggestions require explicit proposal action", () => {
  assert.match(source, /Propor horário/i);
  assert.doesNotMatch(source, /onClick=\{\(\) => api\.post\([^}]*appointment-requests/);
});
