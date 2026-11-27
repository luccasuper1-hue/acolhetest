import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/mvp/mvp.css", import.meta.url), "utf8");

test("mobile refinements keep the panel readable and usable", () => {
  const cycle = css.slice(css.lastIndexOf("/* Ciclo mobile 01"));
  assert.match(cycle, /overflow-x: clip/);
  assert.match(cycle, /overflow-wrap: anywhere/);
  assert.match(cycle, /font-size: 16px/);
  assert.match(cycle, /mvp-card-head/);
  assert.match(cycle, /mvp-row-actions \.button/);
  assert.match(cycle, /\.mvp-flow \{[^}]*overflow-x: auto/s);
  assert.match(cycle, /safe-area-inset-bottom/);
  assert.match(cycle, /mvp-table-scroll/);
  assert.match(cycle, /scroll-margin-top/);
});

test("mobile refinements are scoped to narrow viewports", () => {
  const cycle = css.slice(css.lastIndexOf("/* Ciclo mobile 01"));
  assert.match(cycle, /^\/\* Ciclo mobile 01[\s\S]*@media \(max-width: 640px\)/);
});
