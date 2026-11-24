import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("institution panel keeps only the visual future marker", () => {
  const panel = read("src/mvp/InstitutionArea.jsx");
  const css = read("src/mvp/mvp.css");
  assert.match(panel, /FutureInsightsLauncher/);
  assert.match(panel, /institution-insights-sparkle|Sparkle/);
  assert.doesNotMatch(panel, /\/institutions\/me\/insights|INSIGHT_QUESTIONS|InsightChatResult|Aprofundar/);
  assert.doesNotMatch(css, /institution-insights-popover|institution-insights-chat|insight-result-v2|insight-question-form/);
  assert.match(css, /institution-insights-sparkle/);
});

test("public copy marks automation as future-only", () => {
  const institutional = read("src/components/Institutional.jsx");
  const data = read("src/data-institutional.js");
  assert.match(institutional, /sem IA ativa/);
  assert.match(data, /podem ser avaliados em fases futuras/);
});
