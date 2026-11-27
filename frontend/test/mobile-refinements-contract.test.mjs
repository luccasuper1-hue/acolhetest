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

test("mobile editorial surfaces preserve safe spacing and readable expansion", () => {
  const cycle = appCss.slice(appCss.lastIndexOf("/* Ciclo mobile 04"));
  assert.match(cycle, /nav-links[^}]*safe-area-inset-bottom/s);
  assert.match(cycle, /skip-link[^}]*safe-area-inset-top/s);
  assert.match(cycle, /\.footer[^}]*safe-area-inset-bottom/s);
  assert.match(cycle, /resource-card > button[^}]*min-height: 60px/s);
  assert.match(cycle, /faq-item button[^}]*min-height: 54px/s);
  assert.match(cycle, /onboarding-card[^}]*100dvh/s);
  assert.match(cycle, /journey-timeline[^}]*overflow-x: auto/s);
  assert.match(cycle, /notfound-inner[^}]*100dvh/s);
  assert.match(cycle, /cta-inner \.button[^}]*min-height: 48px/s);
  assert.match(cycle, /footer-cookie-settings[^}]*overflow-wrap: anywhere/s);
});

test("mobile student surfaces avoid overlap with fixed controls", () => {
  const cycle = appCss.slice(appCss.lastIndexOf("/* Ciclo mobile 05"));
  assert.match(cycle, /app-mobile-top[^}]*safe-area-inset-top/s);
  assert.match(cycle, /app-content[^}]*safe-area-inset-bottom/s);
  assert.match(cycle, /app-main[^}]*padding-inline: 14px/s);
  assert.match(cycle, /bottom-nav[^}]*max-width: 430px/s);
  assert.match(cycle, /corner-quick[^}]*safe-area-inset-bottom/s);
  assert.match(cycle, /corner-logo[^}]*safe-area-inset-bottom/s);
  assert.match(cycle, /mood-actions[^}]*grid-template-columns: 1fr/s);
  assert.match(cycle, /search-field input[^}]*font-size: 16px/s);
  assert.match(cycle, /profile-hero[^}]*flex-wrap: wrap/s);
  assert.match(cycle, /video-name[^}]*overflow-wrap: anywhere/s);
});
