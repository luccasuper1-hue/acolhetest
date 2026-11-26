import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/mvp/ProfessionalArea.jsx", import.meta.url), "utf8");
test("professional panel keeps operational metrics and safe manual drafts", () => {
  assert.doesNotMatch(source, /Radar de hoje|serverRadar|computedRadarItems/);
  assert.match(source, /professional-capacity-card/);
  assert.match(source, /availability_id/);
  assert.match(source, /professional-checklist/);
  assert.match(source, /Nada é enviado automaticamente/);
  assert.match(source, /professional-message-drafts-card/);
  assert.match(source, /<details id="professional-capacity-card" className="mvp-card mvp-collapsible-card/);
  assert.match(source, /<details id="professional-message-drafts-card" className="mvp-card mvp-collapsible-card/);
  assert.ok(source.indexOf('id="professional-completed-card"') < source.indexOf('id="professional-capacity-card"'));
});

test("professional suggestions require explicit proposal action", () => {
  assert.match(source, /Propor horário/i);
  assert.doesNotMatch(source, /onClick=\{\(\) => api\.post\([^}]*appointment-requests/);
});
