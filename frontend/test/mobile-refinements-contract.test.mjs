import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/mvp/mvp.css", import.meta.url), "utf8");
const appCss = fs.readFileSync(new URL("../src/App.css", import.meta.url), "utf8");
const institutionalCss = fs.readFileSync(new URL("../src/institutional.css", import.meta.url), "utf8");
const mobileCss = fs.readFileSync(new URL("../src/mobile.css", import.meta.url), "utf8");

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

test("mobile institutional surfaces keep cards and forms readable", () => {
  const cycle = institutionalCss.slice(institutionalCss.lastIndexOf("/* Ciclo mobile 06"));
  assert.match(cycle, /\.inst-card[^}]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.inst-note[^}]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.b2b2c-node[^}]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.inst-strip-actions[^}]*grid-template-columns: 1fr/s);
  assert.match(cycle, /\.capability-card[\s\S]*\.plan-card[^}]*min-width: 0/s);
  assert.match(cycle, /\.market-chip[^}]*white-space: normal/s);
  assert.match(cycle, /\.validation-step[^}]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.how-steps li[^}]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.lead-form input[\s\S]*font-size: 16px/s);
  assert.match(cycle, /\.lead-success[\s\S]*\.lead-error[^}]*overflow-wrap: anywhere/s);
});

test("mobile authenticated panels keep states and actions readable", () => {
  const cycle = css.slice(css.lastIndexOf("/* Ciclo mobile 07"));
  assert.match(cycle, /\.mvp-kpi strong[\s\S]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.mvp-empty[^}]*min-height: 52px/s);
  assert.match(cycle, /\.mvp-load-error[^}]*box-sizing: border-box/s);
  assert.match(cycle, /\.mvp-security-details summary[^}]*min-height: 62px/s);
  assert.match(cycle, /\.mvp-account-privacy-card > summary[^}]*min-height: 62px/s);
  assert.match(cycle, /\.availability-published-head[^}]*flex-direction: column/s);
  assert.match(cycle, /\.professional-appointment-actions[^}]*width: 100%/s);
  assert.match(cycle, /\.mvp-notification-panel-head strong[^}]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.mvp-conversation-panel-head strong[\s\S]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.mvp-tag[^}]*white-space: normal/s);
});

test("mobile conversation and list controls stay usable on narrow screens", () => {
  const cycle = css.slice(css.lastIndexOf("/* Ciclo mobile 08"));
  assert.match(cycle, /\.mvp-conversation-window \.mvp-chat-message[^}]*max-width: 100%/s);
  assert.match(cycle, /\.mvp-conversation-window \.mvp-chat-compose input[^}]*min-width: 0/s);
  assert.match(cycle, /\.mvp-notification-panel[^}]*width: calc\(100vw - 24px\)/s);
  assert.match(cycle, /\.mvp-topbar-right[^}]*max-width: 54vw/s);
  assert.match(cycle, /\.mvp-flow li[^}]*min-height: 36px/s);
  assert.match(cycle, /\.mvp-table-scroll table[^}]*min-width: 560px/s);
  assert.match(cycle, /\.professional-sessions-card \.professional-session-row \.mvp-row-main[^}]*width: 100%/s);
  assert.match(cycle, /\.student-direct-request-card textarea[^}]*min-height: 112px/s);
  assert.match(cycle, /\.mvp-card-head > \.button[^}]*min-height: 42px/s);
  assert.match(cycle, /\.mvp-kpis[^}]*gap: 10px/s);
});

test("mobile controls preserve focus, recovery and touch comfort", () => {
  const cycle = css.slice(css.lastIndexOf("/* Ciclo mobile 09"));
  assert.match(cycle, /\.mvp-shell :is\(a, button, input, select, textarea\):focus-visible[^}]*outline: 3px/s);
  assert.match(cycle, /\.mvp-inline-form label[\s\S]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.mvp-chat-error \.button[^}]*min-height: 44px/s);
  assert.match(cycle, /\.mvp-notification-item[^}]*padding-block: 11px/s);
  assert.match(cycle, /\.mvp-conversation-window[^}]*max-height: calc\(100dvh/s);
  assert.match(cycle, /\.mvp-topbar-inner[^}]*min-width: 0/s);
  assert.match(cycle, /\.mvp-card p[\s\S]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.mvp-table-scroll[^}]*padding-bottom: 6px/s);
  assert.match(cycle, /\.professional-checklist label[\s\S]*min-height: 40px/s);
  assert.match(cycle, /\.professional-slot-suggestions button[^}]*min-height: 44px/s);
});

test("mobile forms and conversation headers keep a stable rhythm", () => {
  const cycle = css.slice(css.lastIndexOf("/* Ciclo mobile 10"));
  assert.match(cycle, /\.mvp-card-head[^}]*gap: 10px/s);
  assert.match(cycle, /\.mvp-row[^}]*align-items: flex-start/s);
  assert.match(cycle, /\.mvp-row-actions[^}]*gap: 8px/s);
  assert.match(cycle, /\.mvp-form[\s\S]*\.mvp-inline-form[^}]*row-gap: 14px/s);
  assert.match(cycle, /\.mvp-form input[\s\S]*min-height: 46px/s);
  assert.match(cycle, /\.mvp-form textarea[\s\S]*min-height: 112px/s);
  assert.match(cycle, /\.mvp-conversation-panel-head[^}]*border-bottom: 1px solid var\(--line\)/s);
  assert.match(cycle, /\.mvp-notification-panel[^}]*overscroll-behavior: contain/s);
  assert.match(cycle, /\.mvp-brand[^}]*flex: 1 1 auto/s);
  assert.match(cycle, /\.mvp-conversation-panel-head \.mvp-conversation-back[\s\S]*min-width: 44px/s);
});

test("mobile public navigation and footer avoid clipping", () => {
  const cycle = appCss.slice(appCss.lastIndexOf("/* Ciclo mobile 11"));
  assert.match(cycle, /\.nav-wrap[^}]*min-width: 0/s);
  assert.match(cycle, /\.mobile-menu[^}]*min-width: 44px/s);
  assert.match(cycle, /\.nav-more-button[^}]*min-height: 44px/s);
  assert.match(cycle, /\.nav-drawer-foot[^}]*gap: 12px/s);
  assert.match(cycle, /\.section h1[\s\S]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.footer-bottom[^}]*align-items: flex-start/s);
  assert.match(cycle, /\.footer-main[^}]*min-width: 0/s);
  assert.match(cycle, /\.lead-foot[^}]*display: grid/s);
  assert.match(cycle, /\.cookie-dialog-head[^}]*align-items: flex-start/s);
  assert.match(cycle, /\.nav-links a:focus-visible[\s\S]*outline: 3px/s);
});

test("mobile student scheduling and bottom navigation stay usable", () => {
  const cycle = mobileCss.slice(mobileCss.lastIndexOf("/* Ciclo mobile 12"));
  assert.match(cycle, /\.bottom-nav[^}]*padding-bottom: env\(safe-area-inset-bottom/s);
  assert.match(cycle, /\.bottom-nav a[\s\S]*min-width: 44px/s);
  assert.match(cycle, /\.app-mobile-top[^}]*overflow: hidden/s);
  assert.match(cycle, /\.mood-band[^}]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.next-session[^}]*min-width: 0/s);
  assert.match(cycle, /\.calendar-panel[^}]*overflow-x: auto/s);
  assert.match(cycle, /\.payment-tabs[^}]*overflow-x: auto/s);
  assert.match(cycle, /\.booking-box input[\s\S]*font-size: 16px/s);
  assert.match(cycle, /\.summary-box[\s\S]*overflow-wrap: anywhere/s);
  assert.match(cycle, /\.confirmation-main \.button[\s\S]*min-height: 46px/s);
});
