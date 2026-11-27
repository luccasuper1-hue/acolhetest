import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/mvp/mvp.css", import.meta.url), "utf8");
const appCss = fs.readFileSync(new URL("../src/App.css", import.meta.url), "utf8");

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

test("public mobile surfaces respect safe areas and dynamic viewport", () => {
  const cycle = appCss.slice(appCss.lastIndexOf("/* Ciclo mobile 02"));
  assert.match(cycle, /overflow-x: clip/);
  assert.match(cycle, /safe-area-inset-top/);
  assert.match(cycle, /safe-area-inset-bottom/);
  assert.match(cycle, /100dvh/);
  assert.match(cycle, /font-size: 16px/);
  assert.match(cycle, /dash-chart/);
  assert.match(cycle, /scroll-margin-top/);
});

test("mobile booking and session flows keep controls reachable", () => {
  const cycle = appCss.slice(appCss.lastIndexOf("/* Ciclo mobile 03"));
  assert.match(cycle, /\.days-row[^}]*overflow-x: auto/s);
  assert.match(cycle, /\.day[^}]*min-height: 68px/s);
  assert.match(cycle, /\.time[^}]*min-height: 46px/s);
  assert.match(cycle, /\.payment-tabs[^}]*overflow-x: auto/s);
  assert.match(cycle, /\.session-main[^}]*100dvh/s);
  assert.match(cycle, /\.session-controls[^}]*grid-template-columns/s);
  assert.match(cycle, /\.notif-panel[^}]*position: fixed/s);
  assert.match(cycle, /\.notif-row[^}]*min-height: 58px/s);
  assert.match(cycle, /\.login-page[^}]*100dvh/s);
  assert.match(cycle, /\.summary-box dd[^}]*overflow-wrap: anywhere/s);
});
