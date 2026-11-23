import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const app = await readFile(resolve(root, "src/App.js"), "utf8");
const cookieConsent = await readFile(resolve(root, "src/components/CookieConsent.jsx"), "utf8");
const notificationBell = await readFile(resolve(root, "src/components/NotificationBell.jsx"), "utf8");
const css = await readFile(resolve(root, "src/mobile.css"), "utf8");
const appCss = await readFile(resolve(root, "src/App.css"), "utf8");
const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
const authMvp = await readFile(resolve(root, "src/mvp/AuthMvp.jsx"), "utf8");
const student = await readFile(resolve(root, "src/mvp/StudentArea.jsx"), "utf8");
const professional = await readFile(resolve(root, "src/mvp/ProfessionalArea.jsx"), "utf8");
const register = await readFile(resolve(root, "src/mvp/RegisterPage.jsx"), "utf8");
const certificateValidation = await readFile(resolve(root, "src/mvp/CertificateValidationPage.jsx"), "utf8");
const admin = await readFile(resolve(root, "src/mvp/AdminArea.jsx"), "utf8");
const analytics = await readFile(resolve(root, "src/lib/analytics.js"), "utf8");
const frontendInstitution = await readFile(resolve(root, "src/mvp/InstitutionArea.jsx"), "utf8");
const mvpCss = await readFile(resolve(root, "src/mvp/mvp.css"), "utf8");
const operations = await readFile(resolve(root, "..", "docs", "OPERATIONS.md"), "utf8");
const releaseStatus = await readFile(resolve(root, "..", "docs", "RELEASE-STATUS.md"), "utf8");
const currentPublishedVersion = releaseStatus.match(/Versão do Worker: `([^`]+)`/)?.[1] || "";
const smokeScript = await readFile(resolve(root, "..", "ops", "smoke-test.ps1"), "utf8");
const verifyRelease = await readFile(resolve(root, "..", "ops", "verify-release.ps1"), "utf8");
const uptimeWorkflow = await readFile(resolve(root, "..", ".github", "workflows", "uptime.yml"), "utf8");
const pilotEvidence = await readFile(resolve(root, "..", "docs", "PILOT-E2E-EVIDENCE.md"), "utf8");
const realtime = await readFile(resolve(root, "src/mvp/api.js"), "utf8");
const routes = await readFile(resolve(root, "..", "cloudflare-worker", "src", "routes.ts"), "utf8");
const indexScript = await readFile(resolve(root, "..", "cloudflare-worker", "scripts", "create-indexes.mjs"), "utf8");
const certificateMigration = await readFile(resolve(root, "..", "ops", "migrations", "backfill-certificate-institution.mjs"), "utf8");
const core = await readFile(resolve(root, "..", "cloudflare-worker", "src", "core.ts"), "utf8");
const workerDb = await readFile(resolve(root, "..", "cloudflare-worker", "src", "db.ts"), "utf8");
const workerPrivacy = await readFile(resolve(root, "..", "cloudflare-worker", "src", "domains", "privacy.ts"), "utf8");
const workerIndex = await readFile(resolve(root, "..", "cloudflare-worker", "src", "index.ts"), "utf8");
const workerConfig = await readFile(resolve(root, "..", "cloudflare-worker", "wrangler.jsonc"), "utf8");
const staticHeaders = await readFile(resolve(root, "public", "_headers"), "utf8");
const viteConfig = await readFile(resolve(root, "vite.config.mjs"), "utf8");
const frontendPackage = await readFile(resolve(root, "package.json"), "utf8");
const frontendBudgetScript = await readFile(resolve(root, "..", "ops", "check-frontend-budget.mjs"), "utf8");
const home = app.slice(app.indexOf("function Home()"), app.indexOf("function InfoPage"));

test("home presents the current MVP rather than a rotating demo", () => {
  assert.match(home, /Um primeiro passo para buscar apoio/);
  assert.match(home, /Fluxo do Acolhe/);
  assert.match(home, /hero-role-\$\{role\}/);
  assert.doesNotMatch(home, /setInterval\(\(\) => setAutoIndex/);
  assert.doesNotMatch(home, /Experiência demonstrativa/);
});

test("mobile home keeps the product card compact", () => {
  assert.match(css, /max-width: 370px/);
  assert.match(css, /\.mvp-role-options \.demo-option/);
});

test("mobile chat follows the dynamic viewport when the keyboard opens", () => {
  assert.match(mvpCss, /\.mvp-conversation-window \.mvp-chat-messages[^}]*max-height: 46dvh/);
});

test("chat loading failures stay visible with a retry action", () => {
  for (const source of [student, professional]) {
    assert.match(source, /Não foi possível carregar as mensagens/);
    assert.match(source, /Tentar novamente/);
    assert.match(source, /mvp-chat-error/);
  }
});

test("chat switching clears drafts and prevents sending during history loading", () => {
  for (const source of [student, professional]) {
    assert.match(source, /setChatDraft\(""\)/);
    assert.match(source, /chatBusy \|\| chatLoading/);
  }
});

test("chat composer keeps an accessible label and bounded message length", () => {
  for (const source of [student, professional]) {
    assert.match(source, /aria-label="Mensagem para a conversa"/);
    assert.match(source, /maxLength=\{1000\}/);
    assert.match(source, /disabled=\{chatBusy \|\| !chatDraft\.trim\(\)\}/);
  }
});

test("feedback form guides against sensitive content", () => {
  assert.match(student, /Comentário opcional e operacional; não inclua conteúdo sensível da conversa/);
  assert.match(student, /aria-label="Comentário opcional sobre a experiência"/);
  assert.match(student, /maxLength=\{400\}/);
  assert.match(routes, /payload\?\.comment !== undefined && string\(payload\.comment\)\.length > 400/);
});

test("institution metrics never project feedback comments", () => {
  const metricsStart = routes.indexOf('store.findMany("feedback", { institution_id: institutionId }');
  assert.ok(metricsStart >= 0);
  const metricsSlice = routes.slice(metricsStart, metricsStart + 180);
  assert.match(metricsSlice, /projection: \{ score: 1 \}/);
  assert.doesNotMatch(metricsSlice, /comment/);
});

test("admin surface never renders feedback comments", () => {
  assert.doesNotMatch(admin, /feedback\.comment|comment.*feedback/);
  assert.match(admin, /Indicadores agregados/);
});

test("chat retry restores the latest read receipt state", () => {
  assert.match(student, /const lastRead = \[\.\.\.messages\]\.reverse\(\)\.find\(message => message\.sender_role === "student" && message\.read_at\)/g);
  assert.match(professional, /const lastRead = \[\.\.\.messages\]\.reverse\(\)\.find\(message => message\.sender_role === "professional" && message\.read_at\)/g);
});

test("pilot governance surfaces are wired", () => {
  assert.match(app, /ajuda\/instituicoes/);
  assert.match(app, /termos\/estudante/);
  assert.match(app, /termos\/profissional/);
  assert.match(app, /termos\/instituicao/);
  assert.match(register, /consent_version: "pilot-v1"/);
  assert.match(routes, /consentVersion = string\(payload\.consent_version\)/);
  assert.match(workerIndex, /\/api\/health/);
});

test("cookie consent is versioned and reachable across public and authenticated shells", () => {
  assert.match(app, /<CookieConsent\/>/);
  assert.match(app, /politica-de-cookies/);
  assert.match(app, /footer-cookie-settings/);
  assert.match(shell, /mvp-cookie-settings/);
  assert.match(cookieConsent, /acolhe-cookie-consent-v1/);
  assert.match(cookieConsent, /COOKIE_CONSENT_VERSION = "v1"/);
  assert.match(cookieConsent, /cookie-banner/);
  assert.match(cookieConsent, /cookie-dialog/);
});

test("mobile cookie actions keep the banner compact and touchable", () => {
  assert.match(css, /\.cookie-banner-actions\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.cookie-banner-actions \.button\.primary\s*\{[\s\S]*grid-column: 1 \/ -1/);
  assert.match(css, /\.cookie-banner-actions \.button\s*\{[\s\S]*min-height: 42px/);
});

test("mobile authenticated header stays on one compact row", () => {
  assert.match(mvpCss, /\.mvp-topbar-inner\s*\{[\s\S]*flex-wrap: nowrap/);
  assert.match(mvpCss, /\.mvp-topbar-right \.mvp-pill\s*\{\s*display: none/);
  assert.match(mvpCss, /\.mvp-topbar-right \.mvp-role\s*\{[\s\S]*text-overflow: ellipsis/);
});

test("mobile notification panel stays inside the viewport below the header", () => {
  assert.match(mvpCss, /\.mvp-notification-panel,\s*\.mvp-notification-panel\.is-expanded\s*\{[\s\S]*position: fixed/);
  assert.match(mvpCss, /top: calc\(var\(--mvp-topbar-height\) \+ env\(safe-area-inset-top\) \+ 8px\)/);
  assert.match(mvpCss, /left: 14px;\s*right: 14px;\s*width: auto/);
});

test("mobile panel heading rhythm stays compact without shrinking type", () => {
  assert.match(mvpCss, /\.mvp-head\s*\{\s*margin-bottom: 20px/);
  assert.match(mvpCss, /\.mvp-head h1\s*\{\s*line-height: 1\.08/);
  assert.match(mvpCss, /\.mvp-lead\s*\{\s*margin-top: 8px;\s*line-height: 1\.5/);
});

test("institution mobile operation cards keep a readable compact rhythm", () => {
  assert.match(mvpCss, /institution-operations-grid\s*\{\s*gap: 12px/);
  assert.match(mvpCss, /institution-operations-grid \.mvp-row\s*\{\s*min-height: 52px;\s*padding: 11px 0/);
});

test("admin mobile metrics keep a minimum readable card width", () => {
  assert.match(mvpCss, /@media \(min-width: 420px\) and \(max-width: 640px\)[\s\S]*admin-operational-metrics-card \.mvp-kpis[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mvpCss, /@media \(max-width: 419px\)[\s\S]*admin-operational-metrics-card \.mvp-kpis[\s\S]*grid-template-columns: 1fr/);
});

test("authenticated panels keep anchored content clear of the sticky header", () => {
  assert.match(mvpCss, /\.mvp-shell\s*\{\s*scroll-padding-top: var\(--mvp-topbar-height, 72px\)/);
  assert.match(mvpCss, /scroll-padding-top: calc\(var\(--mvp-topbar-height\) \+ env\(safe-area-inset-top\)\)/);
});

test("professional mobile session actions keep touch targets and long labels safe", () => {
  assert.match(mvpCss, /professional-session-row \.mvp-row-actions\s*\{[\s\S]*gap: 8px/);
  assert.match(mvpCss, /professional-session-row \.mvp-row-actions \.button\s*\{[\s\S]*min-height: 44px[\s\S]*white-space: normal/);
  assert.match(mvpCss, /professional-room-link summary\s*\{\s*min-height: 42px/);
});

test("public mobile footer respects the device safe area", () => {
  assert.match(css, /\.footer\s*\{\s*padding: 24px 20px calc\(18px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.footer-group:last-child\s*\{[\s\S]*row-gap: 2px/);
});

test("public information heroes keep the first fold balanced on mobile", () => {
  assert.match(appCss, /\.info-hero\s*\{\s*padding-top: 76px;\s*padding-bottom: 64px/);
  assert.match(appCss, /\.info-hero h1\s*\{\s*font-size: clamp\(36px, 10vw, 52px\);\s*line-height: 1\.08/);
});

test("narrow public hero actions stack with equal width", () => {
  assert.match(appCss, /@media \(max-width: 390px\)[\s\S]*\.hero-actions\s*\{\s*display: grid;\s*grid-template-columns: 1fr/);
  assert.match(appCss, /\.hero-actions \.button\s*\{\s*width: 100%;\s*min-width: 0/);
});

test("public mobile navigation reserves the bottom safe area", () => {
  assert.match(appCss, /\.nav-links\s*\{[\s\S]*padding: 18px 18px calc\(18px \+ env\(safe-area-inset-bottom\)\)/);
});

test("public mobile menu keeps a visible keyboard focus ring", () => {
  assert.match(appCss, /\.mobile-menu:focus-visible\s*\{[\s\S]*outline: 3px solid/);
});

test("public mobile header CTA keeps a stable touch target", () => {
  assert.match(appCss, /\.header-cta\s*\{\s*min-height: 44px;\s*padding: 11px 14px/);
});

test("public mobile empty states do not create excessive dead space", () => {
  assert.match(appCss, /@media \(max-width: 430px\)[\s\S]*\.empty-state\s*\{\s*padding: 36px 20px/);
});

test("cookie policy names categories and excludes conversation content", () => {
  assert.match(app, /Política de Cookies do/);
  assert.match(app, /Sem conteúdo de conversas/);
  assert.match(app, /Não usamos cookies para publicidade/);
  assert.match(app, /Preferência de cookies/);
  assert.match(app, /Versão 1 da política/);
});

test("public privacy choice distinguishes safeguards from legal review", () => {
  assert.match(app, /as salvaguardas operacionais já valem no piloto/);
  assert.doesNotMatch(app, /regras de consentimento, retenção e atendimento de menores ainda estão em formalização/);
});

test("public privacy copy remains wrap-safe on narrow screens", () => {
  assert.match(appCss, /\.privacy-band \.section-intro/);
  assert.match(appCss, /overflow-wrap: anywhere/);
});

test("public privacy section keeps an accessible heading structure", () => {
  const privacyChoice = app.slice(app.indexOf("function PrivacyChoice"), app.indexOf("function PrivacyChoice") + 1200);
  assert.match(privacyChoice, /data-testid="privacy-choice"/);
  assert.match(privacyChoice, /<h2>/);
  assert.match(privacyChoice, /<h3>/);
});

test("public governance links have matching routes", () => {
  const footer = app.slice(app.indexOf("function Footer"), app.indexOf("function CookiePolicyPage"));
  assert.match(footer, /to="\/privacidade" data-testid="footer-privacy"/);
  assert.match(footer, /to="\/termos" data-testid="footer-terms"/);
  assert.match(footer, /to="\/politica-de-cookies" data-testid="footer-cookies"/);
  assert.match(app, /<Route path="\/privacidade"/);
  assert.match(app, /<Route path="\/termos"/);
  assert.match(app, /<Route path="\/politica-de-cookies"/);
});

test("public route transitions do not hide the page while changing screens", () => {
  assert.match(app, /className=\{`route-fade\$\{homeClass\}`/);
  assert.match(appCss, /\.route-fade \{ animation: none; \}/);
  assert.match(app, /data-testid="notfound-page"/);
});

test("notification panel keeps an internal bounded scroll region", async () => {
  const mvpCss = await readFile(resolve(root, "src/mvp/mvp.css"), "utf8");
  assert.match(mvpCss, /\.mvp-notification-panel \{[^}]*max-height:/s);
  assert.match(mvpCss, /\.mvp-notification-panel \{[^}]*overflow-y: auto/s);
  assert.match(mvpCss, /overscroll-behavior: contain/);
});

test("notification bell preserves dialog focus and accessible labeling", () => {
  assert.match(notificationBell, /aria-haspopup="dialog"/);
  assert.match(notificationBell, /aria-controls=\{panelId\}/);
  assert.match(notificationBell, /role="dialog" aria-modal="false"/);
  assert.match(notificationBell, /panelRef\.current\?\.focus/);
  assert.match(notificationBell, /lockOverlayScroll/);
});

test("notification empty and error states remain actionable", async () => {
  const shellSource = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shellSource, /className="mvp-notification-error" role="status"/);
  assert.match(shellSource, /Não foi possível atualizar as notificações agora/);
  assert.match(shellSource, /className="mvp-notification-empty" role="status"/);
  assert.match(shellSource, /onClick=\{loadNotifications\}/);
  assert.match(shellSource, /onClick=\{loadNotifications\} disabled=\{notificationsLoading\} aria-busy=\{notificationsLoading\}/);
});

test("notification badge and accessible label share the authoritative count", () => {
  assert.match(shell, /aria-label=\{`Notificações\$\{displayedUnreadCount/);
  assert.match(shell, /Math\.min\(displayedUnreadCount, 9\)/);
  assert.match(shell, /Notificações\{displayedUnreadCount > 0/);
});

test("failed notification read batches stay optimistic through reconciliation", () => {
  assert.match(shell, /const failedIds = new Set\(results\.flatMap/);
  assert.match(shell, /unread\.filter\(item => !failedIds\.has\(item\.id\)\)/);
  assert.match(shell, /await loadNotifications\(\);[\s\S]*failedIds\.forEach/);
});

test("notification pagination failures remain retryable", () => {
  assert.match(shell, /if \(!notificationPage\.hasMore \|\| notificationPage\.loading \|\| !notificationPage\.before\) return/);
  assert.match(shell, /setNotificationPage\(current => \(\{ \.\.\.current, loading: false \}\)\)/);
  assert.match(shell, /Não foi possível carregar mais notificações agora/);
});

test("admin analytics stays aggregate and consent-gated", () => {
  assert.match(app, /trackAnalytics\(location\.pathname\)/);
  assert.match(analytics, /measurement === true/);
  assert.match(analytics, /\/api\/analytics/);
  assert.match(analytics, /consent_version: "v1"/);
  assert.match(analytics, /measurement_consent: true/);
  assert.match(admin, /admin-analytics-card/);
  assert.match(admin, /admin-analytics-visitors/);
  assert.match(admin, /admin-funnel/);
  assert.match(admin, /first_request/);
  assert.match(routes, /if \(user\.role !== "admin"\) await logEvent\(env, "access", user, user\.institution_id\)/);
  assert.match(routes, /event\.role !== "admin"/);
  assert.match(workerDb, /\$setOnInsert: \{ id: crypto\.randomUUID\(\), day, created_at: new Date\(\)\.toISOString\(\) \}/);
  assert.match(indexScript, /analytics\.createIndex\(\{ created_at: 1 \}, \{ name: \"analytics_daily_created_at_ttl\", expireAfterSeconds: 366 \* 24 \* 60 \* 60 \}\)/);
  assert.match(indexScript, /analyticsIndexes = await analytics\.listIndexes\(\)\.toArray\(\)/);
});

test("api errors avoid exposing internal server details", async () => {
  const apiSource = await readFile(resolve(root, "src/mvp/api.js"), "utf8");
  assert.match(apiSource, /response\?\.status\) >= 500/);
  assert.match(apiSource, /temporariamente indisponível/);
  assert.doesNotMatch(apiSource, /return error\?\.message/);
});

test("realtime notifications require a stable identifier before insertion", () => {
  assert.match(shell, /const notificationId = String\(event\.notification\.id \|\| ""\)\.trim\(\)/);
  assert.match(shell, /if \(!notificationId\) return/);
  assert.match(shell, /if \(!current\.some\(item => item\.id === notificationId\)\)/);
  assert.match(shell, /if \(!event\.notification\.read\) setUnreadCount/);
});

test("admin audit keeps a stable event identifier", async () => {
  const routes = await readFile(resolve(root, "../cloudflare-worker/src/routes.ts"), "utf8");
  assert.match(routes, /projection: \{ id: 1, type: 1, role: 1, institution_id: 1, created_at: 1 \}/);
  assert.match(routes, /sort: \{ created_at: -1, id: -1 \}/);
  assert.match(routes, /Math\.min\(50, Math\.max\(1, Math\.floor\(requestedLimit\)\)\)/);
  assert.match(routes, /const items = events\.slice\(0, limit\)\.map/);
  assert.match(routes, /has_more: events\.length > items\.length/);
  assert.match(routes, /next_before: last \? `\$\{last\.created_at\}\|\$\{last\.id\}`/);
  assert.match(routes, /beforeDate && !Number\.isNaN\(Date\.parse\(beforeDate\)\)/);
  assert.match(routes, /event metadata may contain[\s\S]*must never become an admin feed payload/);
});

test("admin audit uses safe labels for unknown event types", async () => {
  const admin = await readFile(resolve(root, "src/mvp/AdminArea.jsx"), "utf8");
  assert.match(admin, /AUDIT_LABELS\[event\.type\] \|\| "Atividade operacional"/);
  assert.match(admin, /roleLabel\[event\.role\] \|\| "Perfil interno"/);
});

test("admin audit count is announced accessibly", async () => {
  const admin = await readFile(resolve(root, "src/mvp/AdminArea.jsx"), "utf8");
  assert.match(admin, /<span aria-live="polite">\{auditEvents\.length/);
});

test("admin audit can load the next cursor page without replacing the first page", async () => {
  const admin = await readFile(resolve(root, "src/mvp/AdminArea.jsx"), "utf8");
  assert.match(admin, /const \[auditBefore, setAuditBefore\] = useState\(null\)/);
  assert.match(admin, /api\.get\("\/admin\/audit", \{ params: \{ limit: 30, before: auditBefore \} \}\)/);
  assert.match(admin, /setAuditEvents\(previous => \[\.\.\.previous, \.\.\.\(page\?\.items \|\| \[\]\)/);
  assert.match(admin, /Carregar mais/);
});

test("dashboard load errors remain announced and retryable", async () => {
  const shellSource = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shellSource, /function MvpLoadError\(\{ message, onRetry \}\)/);
  assert.match(shellSource, /<div className="mvp-load-error" role="alert">/);
  assert.match(shellSource, /data-testid=".*retry|onClick=\{onRetry\}/);
  assert.match(shellSource, /className="mvp-dashboard-skeleton"[^>]*aria-live="polite"[^>]*aria-busy="true"/);
});

test("realtime loss fallback is throttled", async () => {
  const shellSource = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shellSource, /realtimeFallbackAt/);
  assert.match(shellSource, /nowMs - realtimeFallbackAt\.current < 15_000/);
});

test("sync warnings are announced atomically", async () => {
  const shellSource = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shellSource, /className="mvp-sync-warning" role="status" aria-live="polite" aria-atomic="true"/);
});

test("realtime refresh timer is cleaned up on unmount", async () => {
  const shellSource = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shellSource, /useEffect\(\(\) => \(\) => \{ if \(realtimeRefreshTimer\.current\) window\.clearTimeout\(realtimeRefreshTimer\.current\); \}, \[\]\)/);
});

test("pending GET deduplication cannot delete a newer session request", async () => {
  const apiSource = await readFile(resolve(root, "src/mvp/api.js"), "utf8");
  assert.match(apiSource, /pendingGets\.get\(key\) === request/);
  assert.match(apiSource, /export function resetPendingGets\(\)/);
  const authSource = await readFile(resolve(root, "src/mvp/AuthMvp.jsx"), "utf8");
  assert.match(authSource, /resetPendingGets\(\);/);
});

test("auth invalidation clears the current session through the shared cleanup", async () => {
  const authSource = await readFile(resolve(root, "src/mvp/AuthMvp.jsx"), "utf8");
  assert.match(authSource, /if \(\[401, 403\]\.includes\(e\?\.response\?\.status\)\)/);
  assert.match(authSource, /setAccount\(null\);\s*clearToken\(\);/);
});

test("pending GET deduplication has a bounded reference map", async () => {
  const apiSource = await readFile(resolve(root, "src/mvp/api.js"), "utf8");
  assert.match(apiSource, /MAX_PENDING_GETS = 256/);
  assert.match(apiSource, /pendingGets\.size >= MAX_PENDING_GETS/);
});

test("API client keeps authenticated cookies and JSON mutation headers", async () => {
  const apiSource = await readFile(resolve(root, "src/mvp/api.js"), "utf8");
  assert.match(apiSource, /withCredentials: true/);
  assert.match(apiSource, /headers\["Content-Type"\] = "application\/json"/);
  assert.match(apiSource, /timeout: 15_000/);
});

test("Worker CORS and CSRF stay origin-bound", async () => {
  const workerIndex = await readFile(resolve(root, "../cloudflare-worker/src/index.ts"), "utf8");
  assert.match(workerIndex, /return origin === env\.FRONTEND_URL \? origin : undefined/);
  assert.match(workerIndex, /access-control-allow-credentials/);
  assert.doesNotMatch(workerIndex, /access-control-allow-origin["']\s*:\s*["']\*["']/);
  assert.match(workerIndex, /hasCookie && origin !== env\.FRONTEND_URL/);
});

test("Worker preflight exposes only required API headers", async () => {
  const workerIndex = await readFile(resolve(root, "../cloudflare-worker/src/index.ts"), "utf8");
  assert.match(workerIndex, /access-control-allow-headers": "authorization, content-type"/);
  assert.match(workerIndex, /access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"/);
  assert.doesNotMatch(workerIndex, /access-control-allow-headers": "\*"/);
});

test("issued certificates keep the professional institution scope", () => {
  assert.match(routes, /const certificate = \{[\s\S]*professional_id: professional\.id, institution_id: professional\.institution_id/);
  assert.match(routes, /const validCertificates = await store\.findMany\("certificates", \{ professional_id: professional\.id, status: "valid" \}/);
  assert.match(routes, /candidate\.institution_id === professional\.institution_id/);
  assert.match(routes, /professional\.institution_id \? validCertificates\.find/);
  assert.match(routes, /requires_regularization: requiresRegularization/);
  assert.match(routes, /if \(!professional\.institution_id \|\| !institution\) return fail\("O profissional precisa estar vinculado a uma instituição ativa\./);
  assert.match(routes, /if \(existing && existing\.institution_id !== professional\.institution_id\) return fail\("O certificado existente precisa ser regularizado/);
  assert.match(routes, /findOne\("institutions", \{ id: professional\.institution_id, active: true \}/);
  assert.match(routes, /findMany\("certificates", \{ institution_id: institution\.id, professional_id: \{ \$in: professionalIds \} \}/);
  assert.match(routes, /certificates: certificates\.map\(\(certificate\) => \(\{[\s\S]*institution_id: certificate\.institution_id/);
  assert.doesNotMatch(routes, /insert\("certificates"/);
  assert.match(workerDb, /if \(!certificate\.institution_id\) throw new Error\("certificate\.institution_id is required"\)/);
  assert.match(workerDb, /if \(!certificate\.professional_id \|\| String\(certificate\.professional_id\) !== String\(professionalId\)\) throw new Error\("certificate professional scope mismatch"\)/);
  assert.match(workerDb, /if \(existing\.institution_id !== certificate\.institution_id\) throw new Error\("certificate institution scope mismatch"\)/);
});

test("professional certificate responses use a public certificate contract", () => {
  assert.match(routes, /const publicCertificate = \(certificate: Doc \| null \| undefined\)/);
  assert.match(routes, /certificate: publicCertificate\(certificate\)/);
  assert.match(routes, /return json\(\{ certificate: publicCertificate\(existing\) \}\)/);
  assert.match(routes, /return json\(\{ certificate: publicCertificate\(issued\) \}, 201\)/);
});

test("certificate backfill audits mismatched institution links without overwriting them", () => {
  assert.match(certificateMigration, /const allCertificates = await database\.collection\("certificates"\)/);
  assert.match(certificateMigration, /const mismatched = allCertificates\.filter/);
  assert.match(certificateMigration, /const orphaned = allCertificates\.filter/);
  assert.match(certificateMigration, /orphaned_certificate_ids/);
  assert.match(certificateMigration, /String\(professionalInstitution \|\| ""\)/);
  assert.match(certificateMigration, /mismatched_certificate_ids/);
  assert.match(certificateMigration, /unresolved_certificate_ids/);
  assert.match(certificateMigration, /status: unresolved \|\| mismatched\.length \|\| orphaned\.length \? "review_required" : "clean"/);
  assert.match(certificateMigration, /id: certificate\.id, \.\.\.missingInstitution/);
});

test("primary home actions present the pilot and keep access available", () => {
  assert.match(home, /data-testid="hero-talk-button"/);
  assert.match(home, /to="\/como-funciona" className="button primary"/);
  assert.match(home, /to="\/entrar" className="button quiet"/);
});

test("role cards lead to the matching audience pages", () => {
  assert.match(home, /\[\["Instituição"[^\]]+"\/instituicoes"/);
  assert.match(home, /\["Estudante"[^\]]+"\/para-estudantes"/);
  assert.match(home, /\["Profissional"[^\]]+"\/profissionais"/);
});

test("role cards use the product icon language", () => {
  assert.match(home, /Building2/);
  assert.match(home, /UserRound/);
  assert.match(home, /GraduationCap/);
  assert.doesNotMatch(home, /["'`]▥["'`]/);
  assert.doesNotMatch(home, /["'`]◯["'`]/);
  assert.doesNotMatch(home, /["'`]⌂["'`]/);
});

test("certificate dates use the product timezone consistently", () => {
  assert.match(certificateValidation, /formatDate\(state\.certificate\.issued_at\)/);
  assert.match(professional, /formatDate\(printable\.issued_at\)/);
  assert.doesNotMatch(certificateValidation, /toLocaleDateString\("pt-BR"\)/);
  assert.doesNotMatch(professional, /new Date\(printable\.issued_at\)\.toLocaleDateString/);
});

test("administrative lead timestamps use the shared product timezone formatter", () => {
  assert.match(admin, /formatDateTime\(lead\.created_at\)/);
  assert.doesNotMatch(admin, /toLocaleString\("pt-BR"\)/);
});

test("appointment notification filter covers the full meeting lifecycle", () => {
  const shellSource = shell;
  for (const type of ["appointment_request_cancelled", "request_cancelled", "request_rescheduled", "request_expired", "request_expiring", "room_link_added"]) {
    assert.match(shellSource, new RegExp(`\\"${type}\\"`));
  }
});

test("certificate codes derive their year from the product timezone", () => {
  assert.match(routes, /code: `AC-\$\{localScheduleParts\(\)\.year\}-/);
  assert.doesNotMatch(routes, /code: `AC-\$\{new Date\(\)\.getFullYear\(\)\}-/);
});

test("professional session actions use the product timezone", () => {
  assert.match(professional, /scheduledTimeHasStarted\(session\?\.date, session\?\.time\)/);
  assert.doesNotMatch(professional, /new Date\(`\$\{session\.date\}T\$\{session\.time\}:00`\)/);
});

test("dashboard-backed panels avoid a duplicate notification polling loop", () => {
  assert.match(shell, /if \(dashboardNotificationsReady \|\| onRefresh \|\| loading\) return undefined/);
});

test("admin user listings exclude authentication and invitation secrets", () => {
  assert.match(routes, /projection: \{ password_hash: 0, invite_token: 0, invite_expires_at: 0, session_version: 0 \}/);
  assert.match(routes, /const adminSafeUser = \(user: Doc, institutionNames: Map<string, string>\) => \(\{ id: user\.id, name: user\.name, email: user\.email, role: user\.role/);
  assert.match(routes, /if \(pathname === "\/api\/admin\/users"/);
});

test("admin request listings exclude free-text student notes", () => {
  assert.match(routes, /findMany\("appointment_requests", \{\}, \{ projection: \{ note: 0, reason_note: 0 \}/);
  assert.match(routes, /findMany\("requests", \{\}, \{ projection: \{ reason_note: 0 \}/);
  assert.match(routes, /const adminSafeRequest = \(record: Doc, institutionNames: Map<string, string>, requestKind: "availability" \| "direct"\)/);
});

test("admin lead payloads use an explicit operational allowlist", () => {
  assert.match(routes, /const adminSafeLead = \(lead: Doc\) => \(\{ id: lead\.id, kind: lead\.kind, status: lead\.status/);
  assert.match(routes, /leads\.map\(adminSafeLead\)/);
  assert.doesNotMatch(routes, /const publicLead =/);
});

test("notification history and realtime payloads expose only the public notification contract", () => {
  assert.match(core, /const publicNotification = \(notification: Doc\) => \(\{ id: notification\.id, type: notification\.type, title: notification\.title, body: notification\.body, read: notification\.read === true, created_at: notification\.created_at/);
  assert.match(core, /notification\.type === "chat_message_received".*meta: \{ session_id: String\(notification\.meta\.session_id\) \}/);
  assert.match(core, /notification: safeNotification/);
  assert.match(core, /const items = rows\.slice\(0, 40\)\.map\(publicNotification\)/);
  assert.doesNotMatch(core, /notification: notification \}\}\);/);
});

test("chat message responses and realtime payloads omit internal sender identifiers", () => {
  assert.match(routes, /const publicSessionMessage = \(message: Doc\) => \(\{ id: message\.id, sender_role: message\.sender_role, body: message\.body, created_at: message\.created_at/);
  assert.match(routes, /\.map\(publicSessionMessage\)/);
  assert.match(routes, /const safeMessage = publicSessionMessage\(record\)/);
  assert.doesNotMatch(routes, /event: \{ type: "message", message: record \}/);
});

test("session payloads omit internal participant and request identifiers", () => {
  assert.match(routes, /const publicSession = \(session: Doc\) => \(\{ id: session\.id, date: session\.date, time: session\.time, duration_minutes: session\.duration_minutes \|\| 30, status: session\.status/);
  assert.match(routes, /sessions\.map\(\(session\) => \{ const record = requestById\.get\(session\.request_id\); return \{ \.\.\.publicSession\(session\)/);
  assert.match(routes, /const session = sessionByRequest\.get\(record\.id\); return \{ id: record\.id, date: record\.date, time: record\.time, status: record\.status[\s\S]*session: session \? publicSession\(session\) : null/);
  assert.match(routes, /const publicStudentRequest = \(record: Doc, extras: Doc = \{\}\)/);
  assert.match(routes, /professional_name: pro \? accountById\.get\(pro\.user_id\)[\s\S]*session: session \? publicSession\(session\) : null/);
  assert.match(routes, /logEvent\(env, "request_created"[\s\S]*return json\(publicStudentRequest\(record\), 201\)/);
  assert.match(routes, /logEvent\(env, "appointment_request_created"[\s\S]*return json\(publicStudentRequest\(record, \{ note: record\.note \}\), 201\)/);
  assert.doesNotMatch(routes, /return json\(record, 201\)/);
  assert.doesNotMatch(routes, /return json\(sessions\.map\(\(session\) => \{ const record = requestById\.get\(session\.request_id\); return \{ \.\.\.session,/);
});

test("professional dashboard request payloads use explicit public allowlists", () => {
  assert.match(routes, /const publicProfessionalProfile = \(professional: Doc\)/);
  assert.match(routes, /professional: publicProfessionalProfile\(professional\)/);
  assert.match(routes, /const publicProfessionalAppointmentRequest = \(record: Doc, extras: Doc = \{\}\)/);
  assert.match(routes, /appointment_requests: appointmentRequests\.map\(\(record\) => \{ const student = studentById\.get\(record\.student_id\); return publicProfessionalAppointmentRequest/);
  assert.doesNotMatch(routes, /appointment_requests: appointmentRequests\.map\(\(record\) => \{ const student = studentById\.get\(record\.student_id\); return \{ \.\.\.record/);
});

test("availability payloads omit internal institution and professional identifiers", () => {
  assert.match(routes, /const publicAvailability = \(slot: Doc\) => \(\{ id: slot\.id, date: slot\.date, time: slot\.time, duration_minutes: slot\.duration_minutes \|\| 30/);
  assert.match(routes, /availability: availability\.map\(publicAvailability\)/);
  assert.match(routes, /return json\(created\.map\(publicAvailability\), 201\)/);
  assert.match(routes, /slots: \(slotsByProfessional\.get\(professional\.id\) \|\| \[\]\)\.map\(slot => publicAvailability/);
  assert.match(routes, /findMany\("availability", \{ professional_id: professional\.id, date: \{ \$gte: localToday\(\) \} \}.*\)\.map\(publicAvailability\)/);
});

test("feedback and referral writes return minimized confirmation payloads", () => {
  assert.match(routes, /return json\(\{ ok: true \}, 201\)/);
  assert.match(routes, /const publicReferral = \(referral: Doc \| null \| undefined\) => referral \? \(\{ status: referral\.status, note: referral\.note \|\| null, created_at: referral\.created_at \}\) : null/);
  assert.match(routes, /return json\(publicReferral\(savedReferral\.record\), 200\)/);
});

test("JSON API responses disable browser caching for fresh panel state", () => {
  assert.match(core, /"cache-control": "no-store"/);
});

test("session-creating mutations return the minimized session contract", () => {
  assert.match(routes, /return json\(publicSession\(session\), 201\)/);
  assert.match(routes, /return json\(publicSession\(session\)\);/);
  assert.doesNotMatch(routes, /return json\(session, 201\)/);
  assert.doesNotMatch(routes, /return json\(session\); \}/);
});

test("MVP roles stay behind their protected areas", () => {
  assert.match(app, /path="\/aluno" element={<RequireRole role="student">/);
  assert.match(app, /path="\/profissional" element={<RequireRole role="professional">/);
  assert.match(app, /path="\/instituicao" element={<RequireRole role="institution">/);
  assert.match(app, /path="\/admin" element={<RequireRole role="admin">/);
});

test("protected areas redirect missing or mismatched roles", () => {
  assert.ok(authMvp.includes("if (!user) return <Navigate to={`/entrar?next=${location.pathname}`"));
  assert.ok(authMvp.includes('if (user.role !== role) return <Navigate to={HOME_BY_ROLE[user.role] || "/"}'));
});

test("legacy beta paths are kept behind the MVP entry point", () => {
  assert.match(app, /const isLegacyPath = location\.pathname === "\/login-demo"/);
  assert.match(app, /location\.pathname === "\/profissional-dashboard"/);
  assert.match(app, /location\.pathname === "\/instituicoes\/painel"/);
  assert.match(app, /location\.pathname === "\/app"/);
  assert.match(app, /location\.pathname\.startsWith\("\/app\/"\)/);
  assert.match(app, /if \(isLegacyPath\) return <Navigate to="\/entrar" replace \/>/);
});

test("informational CTAs do not promise the retired beta", () => {
  assert.match(app, /data-testid="info-primary-cta">Entrar no Acolhe/);
  assert.match(app, /data-testid="professional-form-cta">Registrar interesse profissional/);
  assert.match(app, /data-testid="institution-dashboard-link">Entrar como instituição/);
  assert.doesNotMatch(app, /data-testid="info-primary-cta">Ver a experiência demonstrativa/);
});

test("home remains bounded to the five-block information architecture", () => {
  assert.equal((home.match(/<section className="(hero|problem-band|cta-band)/g) || []).length, 3);
  assert.match(home, /<AudienceBand\/>/);
  assert.match(home, /<FaqSection compact\/>/);
});

test("notification history and chat actions stay connected", () => {
  assert.match(shell, /listNotifications|api\.get\(notificationPath\)/);
  assert.match(shell, /has_more/);
  assert.match(shell, /Carregar notificações mais antigas/);
  assert.match(shell, /mvp-open-conversation/);
  assert.match(shell, /setNotificationsOpen\(false\)/);
  assert.match(shell, /mvp-notification-close/);
  assert.match(shell, /Notificações\{displayedUnreadCount > 0/);
  assert.match(shell, /Fechar notificações/);
  assert.match(shell, /role="group" aria-label="Filtrar notificações"/);
  assert.match(shell, /aria-pressed=\{notificationFilter === value\}/);
  assert.match(shell, /id="mvp-notification-items" role="region" aria-label="Lista de notificações"/);
  assert.match(shell, /dashboardNotificationPageLoaded/);
  assert.match(shell, /notifications_changed/);
  assert.match(shell, /notificationPath}\/read/);
  assert.match(student, /dashboardNotifications=\{notifications\}/);
  assert.match(professional, /dashboardNotifications=\{notifications\}/);
  assert.match(shell, /onNotificationsChange\?\.\(merged\)/);
  assert.match(shell, /notificationsRef\.current = merged/);
  assert.match(shell, /previousLoaded\.filter\(item => !next\.some/);
  assert.match(shell, /const optimistic = notificationsRef\.current\.map/);
  assert.match(shell, /loadNotifications\(\)\.then\(loaded => \{ if \(loaded && notificationsOpenRef\.current\) return markNotificationsRead/);
  assert.match(shell, /return false; \}/);
  assert.match(shell, /notificationsOpenRef\.current/);
});

test("realtime notifications update the unread badge immediately", () => {
  assert.match(shell, /if \(!event\.notification\.read\) setUnreadCount\(currentCount => currentCount === null \? currentCount : currentCount \+ 1\)/);
});

test("notification reads stay optimistic while the server reconciles", () => {
  assert.match(shell, /Math\.max\(0, serverUnreadCount - pendingReadIds\.current\.size\)/);
  assert.match(shell, /Math\.max\(0, page\.unread_count - pendingReadIds\.current\.size\)/);
});

test("realtime retries respect hidden tabs", () => {
  assert.match(realtime, /document\.visibilityState === "hidden"/);
  assert.match(realtime, /visibilitychange/);
  assert.match(realtime, /Math\.min\(1000 \* \(2 \*\* attempts\), 30000\)/);
});

test("realtime recovery refreshes data without creating a rapid polling loop", () => {
  assert.match(shell, /if \(status === "open"\) \{/);
  assert.match(shell, /if \(status !== "error" && status !== "closed"\) return/);
  assert.match(shell, /nowMs - realtimeFallbackAt\.current < 15_000/);
  assert.match(shell, /document\.visibilityState === "hidden"/);
});

test("notification and realtime listeners clean up on unmount", () => {
  assert.match(shell, /window\.clearTimeout\(realtimeRefreshTimer\.current\)/);
  assert.match(shell, /document\.removeEventListener\("visibilitychange", refreshWhenVisible\)/);
  assert.match(shell, /document\.removeEventListener\("pointerdown", closeOnOutsideClick\)/);
  assert.match(shell, /document\.removeEventListener\("keydown", closeOnEscape\)/);
});

test("notification panel restores focus to its trigger", () => {
  assert.match(shell, /if \(notificationsOpen\) notificationCloseRef\.current\?\.focus\(\)/);
  assert.match(shell, /if \(previousNotificationsOpen\.current && !notificationsOpen\) notificationTriggerRef\.current\?\.focus\(\)/);
  assert.match(shell, /ref=\{notificationTriggerRef\}/);
  assert.match(shell, /ref=\{notificationCloseRef\}/);
});

test("conversation panel escape closes the selected conversation", () => {
  assert.match(shell, /const closeOnEscape = event => \{ if \(event\.key === "Escape"\) \{ setOpen\(false\); setSelectedId\(null\); \} \}/);
  assert.match(shell, /document\.removeEventListener\("keydown", closeOnEscape\)/);
});

test("conversation empty state is announced", () => {
  assert.match(shell, /className="mvp-conversation-empty" role="status"/);
});

test("realtime reconnect refreshes dashboard state immediately", () => {
  assert.match(shell, /if \(status === "open"\) \{[\s\S]*loadNotifications\(\);[\s\S]*refreshFromRealtime\(\);/);
});

test("notification times use the product timezone", () => {
  assert.match(realtime, /PRODUCT_TIME_ZONE = "America\/Fortaleza"/);
  assert.match(realtime, /year: "numeric"/);
  assert.match(realtime, /timeZone: PRODUCT_TIME_ZONE/);
});

test("bulk notification reads stay scoped to the current recipient", () => {
  assert.match(routes, /\/api\/students\/me\/notifications\/read[\s\S]*recipient_user_id: user\.id/);
  assert.match(routes, /\/api\/professionals\/me\/notifications\/read[\s\S]*recipient_user_id: user\.id/);
  assert.match(routes, /\/api\/institutions\/me\/notifications\/read[\s\S]*recipient_user_id: user\.id/);
  assert.match(routes, /\/api\/admin\/notifications\/read[\s\S]*recipient_user_id: admin\.id/);
});

test("individual notification reads stay scoped to the current recipient", () => {
  assert.match(routes, /findOne\("notifications", \{ id: [^,]+, recipient_user_id: user\.id \}\)/);
  assert.match(routes, /findOne\("notifications", \{ id: adminNotificationId, recipient_user_id: admin\.id \}\)/);
});

test("conversation messages require participant-owned sessions", () => {
  assert.match(routes, /findOne\("sessions", \{ id: studentChatId, student_id: student\.id \}\)/);
  assert.match(routes, /findOne\("sessions", \{ id: professionalChatId, professional_id: professional\.id \}\)/);
  assert.match(workerDb, /session_id: metadata\.sessionId, sender_user_id: \{ \$ne: metadata\.userId \}/);
});

test("public message and realtime payloads omit internal sender identifiers", () => {
  assert.match(routes, /const publicSessionMessage = \(message: Doc\) => \(\{ id: message\.id, sender_role: message\.sender_role, body: message\.body, created_at: message\.created_at/);
  assert.doesNotMatch(routes, /const publicSessionMessage = [^\n]*sender_user_id/);
  assert.match(routes, /event: \{ type: "message", message: safeMessage \}/);
});

test("conversation history and message bodies stay bounded", () => {
  assert.match(routes, /session_messages[\s\S]*limit: 200/);
  assert.match(routes, /body\.length > 1000/);
});

test("realtime socket cleanup releases per-socket state", () => {
  assert.match(workerDb, /webSocketClose\(socket: WebSocket\)/);
  assert.match(workerDb, /this\.inboundWindows\.delete\(socket\)/);
  assert.match(workerDb, /getWebSockets\(\)/);
});

test("realtime broadcast failures close only the affected socket", () => {
  assert.match(workerDb, /try \{ socket\.send\(message\); \} catch \{ socket\.close\(1011, "broadcast failed"\); \}/);
  assert.match(workerDb, /webSocketError\(\) \{ \/\* a reconnecting client will establish a fresh socket \*\//);
});

test("realtime upgrades require origin, session and participant checks", () => {
  assert.match(workerIndex, /async function realtimeUpgrade\(request: Request, env: Env, url: URL\)/);
  assert.match(workerIndex, /if \(origin && origin !== env\.FRONTEND_URL\) return fail\("Origem não autorizada", 403\)/);
  assert.match(workerIndex, /const user = await currentUser\(request, env\)/);
  assert.match(workerIndex, /if \(!allowed\) return fail\("Você não participa desta conversa", 403\)/);
});

test("realtime forwarding has a bounded timeout and scoped internal headers", () => {
  assert.match(workerIndex, /AbortSignal\.timeout\(5_000\)/);
  assert.match(workerIndex, /"x-realtime-user"/);
  assert.match(workerIndex, /"x-realtime-role"/);
  assert.match(workerIndex, /"x-realtime-session"/);
  assert.match(workerIndex, /"x-realtime-institution"/);
});

test("Durable Object realtime handlers are reachable only through Worker bindings", () => {
  assert.match(workerDb, /url\.pathname === "\/realtime\/broadcast"/);
  assert.match(workerDb, /url\.pathname !== "\/realtime\/socket"/);
  assert.doesNotMatch(workerIndex, /url\.pathname === "\/realtime\/broadcast"/);
});

test("internal realtime broadcasts reject oversized or malformed payloads", () => {
  assert.match(workerDb, /raw\.byteLength > 32 \* 1024/);
  assert.match(workerDb, /if \(payload\?\.event && typeof payload\.event === "object" && !Array\.isArray\(payload\.event\)\)/);
  assert.match(workerDb, /return new Response\("Payload too large", \{ status: 413 \}\)/);
});

test("realtime broadcasts match session, user or institution scopes explicitly", () => {
  assert.match(workerDb, /const matchesSession = payload\.sessionId && metadata\.sessionId === payload\.sessionId/);
  assert.match(workerDb, /const matchesUser = metadata\.userId && recipients\.has\(metadata\.userId\)/);
  assert.match(workerDb, /const matchesInstitution = payload\.institutionId && metadata\.institutionId === payload\.institutionId/);
  assert.match(workerDb, /if \(!matchesSession && !matchesUser && !matchesInstitution\) continue/);
});

test("realtime socket attachments keep only routing metadata", () => {
  assert.match(workerDb, /const metadata = \{ sessionId: request\.headers\.get\("x-realtime-session"\)/);
  assert.match(workerDb, /userId: request\.headers\.get\("x-realtime-user"\)/);
  assert.match(workerDb, /institutionId: request\.headers\.get\("x-realtime-institution"\)/);
  assert.match(workerDb, /role: request\.headers\.get\("x-realtime-role"\)/);
  assert.doesNotMatch(workerDb, /serializeAttachment\(\{[^\n]*body/);
});

test("presence and typing events do not expose internal user IDs", () => {
  assert.match(workerDb, /event: \{ type: "presence", role: metadata\.role, online/);
  assert.match(workerDb, /event: \{ type: "typing", role: metadata\.role, active/);
  assert.doesNotMatch(workerDb, /event: \{ type: "presence", userId:/);
  assert.doesNotMatch(workerDb, /event: \{ type: "typing", userId:/);
});

test("message read events expose only the receipt contract", () => {
  assert.match(workerDb, /event: \{ type: "message_read", messageId: payload\.messageId, readAt \}/);
  assert.doesNotMatch(workerDb, /event: \{ type: "message_read", userId:/);
});

test("realtime client cleanup removes visibility listeners and closes the socket", () => {
  assert.match(realtime, /document\.addEventListener\("visibilitychange", resumeWhenVisible\)/);
  assert.match(realtime, /document\.removeEventListener\("visibilitychange", resumeWhenVisible\)/);
  assert.match(realtime, /try \{ socket\?\.close\(\); \} catch/);
});

test("realtime reconnect ignores stale socket generations", () => {
  assert.match(realtime, /let generation = 0/);
  assert.match(realtime, /const currentGeneration = \+\+generation/);
  assert.match(realtime, /if \(currentGeneration !== generation\) return/);
  assert.match(realtime, /generation \+= 1/);
});

test("realtime retries use bounded exponential backoff", () => {
  assert.match(realtime, /Math\.min\(1000 \* \(2 \*\* attempts\), 30000\)/);
  assert.match(realtime, /if \(stopped \|\| document\.visibilityState === "hidden" \|\| retryTimer\) return/);
  assert.match(realtime, /attempts \+= 1/);
});

test("institution notifications exclude retired availability events from list and unread count", () => {
  const start = routes.indexOf('if (pathname === "/api/institutions/me/notifications"');
  const end = routes.indexOf('if (pathname === "/api/institutions/me/notifications/read"', start);
  assert.ok(start >= 0 && end > start);
  assert.match(routes.slice(start, end), /excludeTypes: \["availability_published", "availability_published_for_request"\]/);
  assert.match(core, /store\.count\("notifications", \{ \.\.\.baseFilter, read: \{ \$ne: true \} \}\)/);
});

test("institution metrics expose response time and attendance without private content", () => {
  assert.match(routes, /response_time_minutes_avg/);
  assert.match(routes, /responses_within_48h/);
  assert.match(routes, /attendance_rate/);
  assert.match(frontendInstitution, /Tempo médio até resposta/);
  assert.match(frontendInstitution, /Comparecimento/);
  assert.match(frontendInstitution, /metrics\?\.metrics_note/);
  assert.match(admin, /metrics\?\.metrics_note/);
  assert.match(mvpCss, /admin-analytics-note[^}]*overflow-wrap: anywhere/);
  assert.doesNotMatch(routes, /reason_note.*institutionMetrics/);
});

test("institution impact report explains period and protects small samples", () => {
  assert.match(routes, /minimum_sample_size: 5/);
  assert.match(routes, /baseline_available: false/);
  assert.match(routes, /responseSamples\.length >= 5/);
  assert.match(routes, /attendanceSessions\.length >= 5/);
  assert.match(frontendInstitution, /Relatório do piloto/);
  assert.match(frontendInstitution, /aguardando.*casos/);
  assert.match(frontendInstitution, /Linha de base/);
});

test("requests always expose an operational next step and response deadline", () => {
  assert.match(routes, /RESPONSE_WINDOW_MS = 48 \* 60 \* 60 \* 1000/);
  assert.match(routes, /response_due_at/);
  assert.match(routes, /response_state/);
  assert.match(routes, /next_step/);
  assert.match(routes, /requests_due_soon/);
  assert.match(routes, /requests_overdue/);
  assert.match(frontendInstitution, /Pedidos sem resposta no prazo/);
  assert.match(frontendInstitution, /Definir próximo passo com o estudante/);
});

test("notification history stays cursor-paginated", () => {
  assert.match(core, /limit: 41/);
  assert.match(core, /rows\.slice\(0, 40\)/);
  assert.match(core, /has_more: rows\.length > items\.length/);
  assert.match(core, /next_before: last \? `\$\{last\.created_at\}\|\$\{last\.id\}`/);
});

test("API responses enforce HTTPS with HSTS", () => {
  assert.match(workerIndex, /strict-transport-security/);
  assert.match(workerIndex, /max-age=31536000; includeSubDomains/);
  assert.match(staticHeaders, /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
  assert.match(workerIndex, /x-content-type-options/);
  assert.match(workerIndex, /x-frame-options/);
  assert.match(workerIndex, /referrer-policy/);
  assert.match(workerIndex, /permissions-policy/);
  assert.match(workerIndex, /headers\.set\("cache-control", "no-store"\)/);
});

test("archiving an institution invalidates existing user sessions", () => {
  assert.match(routes, /institution_archived/);
  assert.match(routes, /updateMany\("users", \{ institution_id: institutionId, active: \{ \$ne: false \} \}, \{ \$inc: \{ session_version: 1 \} \}\)/);
});

test("direct request decisions refresh institution and admin panels", () => {
  const acceptStart = routes.indexOf('if (acceptId && request.method === "POST")');
  const declineStart = routes.indexOf('if (declineId && request.method === "POST")');
  assert.ok(acceptStart >= 0 && declineStart > acceptStart);
  const declineEnd = routes.indexOf('if (roomId && request.method === "POST")', declineStart);
  const decisionRoutes = routes.slice(acceptStart, declineEnd);
  assert.equal((decisionRoutes.match(/refreshPanels\(env, store, professional\.institution_id, "institution"\)/g) || []).length, 2);
  assert.equal((decisionRoutes.match(/refreshPanels\(env, store, professional\.institution_id, "admin"\)/g) || []).length, 2);
  assert.match(decisionRoutes, /refreshStudentPanels\(env, store, professional\.institution_id\)/);
});

test("appointment confirmation refreshes the professional panel", () => {
  assert.match(routes, /async function refreshProfessionalPanel/);
  const start = routes.indexOf('const appointmentConfirmId = pathParameter');
  const end = routes.indexOf('if (pathname === "/api/students/me/availability-interest"', start);
  assert.match(routes.slice(start, end), /refreshProfessionalPanel\(env, store, record\.professional_id\)/);
});

test("expired requests refresh every affected panel scope", () => {
  const start = routes.indexOf("async function expirePendingRequests");
  const end = routes.indexOf("function sessionReminderNotifications", start);
  const block = routes.slice(start, end);
  assert.match(block, /scope: "professional"/);
  assert.match(block, /refreshPanels\(env, store, institutionId, "institution"\)/);
  assert.match(block, /refreshPanels\(env, store, institutionId, "admin"\)/);
});

test("SLA expiration runs on a scheduled worker and is idempotent", () => {
  assert.ok(workerConfig.includes('"crons": ["*/15 * * * *"]'));
  assert.match(workerIndex, /async scheduled\(_controller: ScheduledController/);
  assert.match(workerIndex, /getMaintenanceSnapshot/);
  assert.match(workerIndex, /expirePendingRequests\(store, env, undefined, snapshot\)/);
  const start = routes.indexOf("async function expirePendingRequestsWork");
  const end = routes.indexOf("function sessionReminderNotifications", start);
  const block = routes.slice(start, end);
  assert.match(block, /status: \"pending\"/);
  assert.match(block, /dedupe_key: `request-expiring:\$\{record\.id\}`/);
  assert.match(block, /dedupe_key: `appointment-expired:\$\{record\.id\}:student`/);
});

test("session reminders do not block authenticated dashboards", () => {
  const studentStart = routes.indexOf('if (pathname === "/api/students/me/dashboard"');
  const professionalStart = routes.indexOf('if (pathname === "/api/professionals/me/dashboard"');
  assert.ok(studentStart >= 0 && professionalStart > studentStart);
  const studentBlock = routes.slice(studentStart, professionalStart);
  const professionalEnd = routes.indexOf('if (pathname === "/api/professionals/me/availability"', professionalStart);
  const professionalBlock = routes.slice(professionalStart, professionalEnd);
  assert.match(studentBlock, /ctx\.waitUntil\(sessionReminderNotifications/);
  assert.match(professionalBlock, /ctx\.waitUntil\(sessionReminderNotifications/);
  assert.doesNotMatch(studentBlock, /await sessionReminderNotifications/);
  assert.doesNotMatch(professionalBlock, /await sessionReminderNotifications/);
});

test("notification page reads and unread count are independent", () => {
  const start = core.indexOf("export async function listNotificationsPage");
  const end = core.indexOf("export async function listNotifications(env", start);
  const block = core.slice(start, end);
  assert.match(block, /const \[rows, unread_count\] = await Promise\.all/);
  assert.match(block, /store\.findMany\("notifications"/);
  assert.match(block, /store\.count\("notifications"/);
});

test("notification email delivery retries without duplicating the in-app notification", () => {
  assert.match(core, /email_delivery: \{ status: "pending", attempts: 0, next_attempt_at: now\(\) \}/);
  assert.match(routes, /email_delivery\.status.*sending/);
  assert.match(routes, /retryNotificationEmails/);
  assert.match(routes, /retry_limit_reached/);
  assert.match(workerIndex, /retryNotificationEmails\(env, store, snapshot\.notificationCandidates\)/);
});

test("institution and admin notification fan-out shares idempotent email delivery", () => {
  assert.doesNotMatch(routes, /notifyInstitutionManagers[\s\S]{0,300}createNotifications\(/);
  assert.doesNotMatch(routes, /notifyAdmins[\s\S]{0,300}createNotifications\(/);
  assert.match(routes, /async function notifyManyUsers/);
  assert.match(routes, /fanout:\$\{type\}:\$\{String\(stableKey\)\}:\$\{recipientId\}/);
  assert.match(routes, /feedback_id: record\.id/);
  assert.match(routes, /session_id: completeId, institution_id/);
});

test("account-bound transactional notices use the retryable notification queue", () => {
  assert.match(routes, /student_registration_received/);
  assert.match(routes, /student_registration_completed/);
  assert.match(routes, /professional_invite/);
  assert.match(routes, /password_changed/);
  assert.match(routes, /password_reset_completed/);
  assert.doesNotMatch(routes, /sendNotificationEmail\(env, address, "Cadastro concluído no Acolhe"/);
  assert.doesNotMatch(routes, /sendNotificationEmail\(env, address, "Convite para entrar no Acolhe"/);
});

test("institution approval and access changes also use retryable account notices", () => {
  assert.match(routes, /institution_access_approved/);
  assert.match(routes, /account_access_restored/);
  assert.match(routes, /account_access_disabled/);
  assert.doesNotMatch(routes, /sendNotificationEmail\(env, String\(lead\.email\), "Acesso institucional aprovado"/);
  assert.doesNotMatch(routes, /sendNotificationEmail\(env, String\(target\.email\), active \? "Acesso reativado"/);
});

test("notification retry has a dedicated compound index and ignores legacy records safely", () => {
  assert.match(indexScript, /notifications_email_delivery_retry/);
  assert.match(routes, /email_delivery\.status.*pending/);
  assert.match(routes, /email_delivery\.status.*sending/);
  assert.match(routes, /limit: 100/);
});

test("capacity records carry duration and reject overlapping direct proposals", () => {
  assert.match(routes, /const slotDurationMinutes =/);
  assert.match(routes, /const intervalsOverlap =/);
  assert.match(routes, /duration_minutes: duration/);
  assert.match(workerDb, /async createAvailabilityBatch\(professionalId: string, slots: RecordDoc\[\]\)/);
  assert.match(workerDb, /existing\.some\(record => overlap\(String\(slot\.date\), String\(slot\.time\), duration, record\)\)/);
  assert.match(workerDb, /slots\.some\(other => other !== slot && overlap/);
  assert.match(workerDb, /async reservePublishedCapacity\(slotId: string, professionalId: string\)/);
  assert.match(workerDb, /async createPublishedStudentRequest\(record: RecordDoc\)/);
  assert.match(routes, /se sobrepõe a outro compromisso/);
  assert.match(routes, /proposeDirectAppointment\(appointmentProposeId, generatedSlot\)/);
  assert.match(workerDb, /async proposeDirectAppointment\(requestId: string, slot: RecordDoc\)/);
  assert.match(workerDb, /this\.withCapacityLock\(String\(slot\.professional_id\)/);
  assert.match(workerDb, /appointment_requests"\)\.updateOne\(/);
  assert.match(workerDb, /availability"\)\.insertOne\(slot, \{ session \}\)/);
});

test("published booking validates open capacity and the institution professional link", () => {
  const start = routes.indexOf('if (pathname === "/api/students/me/requests" && request.method === "POST")');
  const end = routes.indexOf('if (pathname === "/api/students/me/requests" && request.method === "GET")', start);
  const block = routes.slice(start, end);
  assert.match(block, /slot\.status !== "open"/);
  assert.match(block, /findOne\("professionals", \{ id: slot\.professional_id, institution_id: student\.institution_id \}/);
});

test("published rescheduling locks both source and target professionals", () => {
  assert.match(workerDb, /private async withCapacityLocks<T>\(professionalIds: string\[\]/);
  assert.match(workerDb, /async reschedulePublishedRequest\(requestId: string, studentId: string, oldSlotId: string \| undefined, slot: RecordDoc, changes: RecordDoc, oldProfessionalId\?: string\)/);
  assert.match(workerDb, /withCapacityLocks\(\[String\(slot\.professional_id\), String\(oldProfessionalId \|\| slot\.professional_id\)\]/);
  assert.match(routes, /reschedulePublishedRequest\(rescheduleId, student\.id, record\.availability_id, slot, \{[\s\S]*\}, record\.professional_id\)/);
});

test("capacity release paths keep the professional scope", () => {
  const releaseFilter = /id: availabilityId, professional_id: professionalId, status: "reserved"/g;
  assert.equal((workerDb.match(releaseFilter) || []).length, 6);
});

test("direct confirmation shares the professional capacity lock", () => {
  assert.match(workerDb, /async confirmDirectAppointment\(requestId: string, studentId: string, appointment: RecordDoc, professionalId\?: string\)/);
  assert.match(workerDb, /return this\.withCapacityLock\(String\(professionalId \|\| appointment\.professional_id\)/);
  assert.match(routes, /confirmDirectAppointment\(appointmentConfirmId, student\.id, session, record\.professional_id\)/);
});

test("minor approval stays institution-scoped and rolls back when audit fails", () => {
  const start = routes.indexOf("const minorApprovalId = pathParameter");
  const end = routes.indexOf("const fallbackId = pathParameter", start);
  const block = routes.slice(start, end);
  assert.match(block, /institution_id: institution\.id/);
  assert.match(block, /guardian_review_status: \"pending_institution_review\"/);
  assert.match(block, /approveMinorRegistration\(minorApprovalId, institution\.id, user\.id, validationMethod\)/);
  assert.match(workerDb, /async approveMinorRegistration\(userId: string, institutionId: string, actorId: string, validationMethod: string\)/);
  assert.match(workerDb, /withTransaction\(async \(\) =>/);
});

test("minor age classification uses the product timezone and keeps children pending", () => {
  assert.match(workerPrivacy, /PRODUCT_TIME_ZONE = "America\/Fortaleza"/);
  assert.match(routes, /const ageOnDate = \(birthDate: string\) =>/);
  assert.match(routes, /timeZone: APP_TIME_ZONE/);
  assert.match(workerPrivacy, /CHILD_AGE_LIMIT = 12/);
  assert.match(routes, /active: !isChild/);
  assert.match(routes, /guardian_review_status: isChild \? "pending_institution_review"/);
});

test("appointment cancellation notifies the professional", () => {
  const start = routes.indexOf('const appointmentCancelId = pathParameter');
  const end = routes.indexOf('const appointmentConfirmId = pathParameter', start);
  const block = routes.slice(start, end);
  assert.match(block, /appointment_request_cancelled/);
  assert.match(block, /notifyUser\(env, String\(professional\.user_id\)/);
});

test("accepted professional invitations refresh the admin panel", () => {
  const start = routes.indexOf('const acceptToken = pathParameter');
  const end = routes.indexOf('if (pathname === "/api/auth/forgot-password"', start);
  const block = routes.slice(start, end);
  assert.match(block, /professional_invite_accepted/);
  assert.match(block, /refreshPanels\(env, store, String\(user\.institution_id\), "admin"\)/);
});

test("schedule comparisons use the product timezone", () => {
  assert.match(workerPrivacy, /PRODUCT_TIME_ZONE = "America\/Fortaleza"/);
  assert.match(routes, /scheduleTimestamp/);
  assert.match(routes, /localCurrentTime/);
});

test("completed sessions accept past calendar dates", () => {
  assert.match(routes, /validDateShape\(session\.date\).*session\.date < today/);
});

test("certificate visibility and revocation stay role-scoped", () => {
  assert.match(routes, /certificates\", \{ institution_id: institution\.id, professional_id: \{ \$in: professionalIds \} \}/);
  assert.match(routes, /professional_id: professional\.id, institution_id: professional\.institution_id/);
  assert.match(routes, /institution_id: certificate\.institution_id \|\| null/);
  assert.match(routes, /pathParameter\(pathname, "\/api\/admin\/certificates\/", "\/revoke"\)/);
  assert.match(routes, /findOne\("certificates", \{ code: certificateCode, status: "valid" \},/);
  assert.doesNotMatch(frontendInstitution, /admin\/certificates/);
});

test("login distinguishes disabled accounts from archived institutions", () => {
  const start = routes.indexOf("async function login");
  const end = routes.indexOf("async function authRoutes", start);
  const block = routes.slice(start, end);
  assert.match(block, /user\.active === false/);
  assert.match(block, /loginInstitution\?\.active === false/);
  assert.match(block, /Acesso desativado/);
  assert.match(block, /Instituição arquivada/);
});

test("archived institutions cannot activate pending professional invites", () => {
  const inviteStart = routes.indexOf('const inviteToken = pathParameter(pathname, "/api/auth/invite/")');
  const acceptStart = routes.indexOf('const acceptToken = pathParameter(pathname, "/api/auth/invite/", "/accept")');
  assert.ok(inviteStart >= 0 && acceptStart > inviteStart);
  const inviteBlock = routes.slice(inviteStart, acceptStart);
  const acceptBlock = routes.slice(acceptStart, routes.indexOf('if (pathname === "/api/auth/forgot-password"', acceptStart));
  assert.match(inviteBlock, /institution\?\.active === false\) return fail\("Instituição arquivada/);
  assert.match(acceptBlock, /inviteInstitution\?\.active === false\) return fail\("Instituição arquivada/);
});

test("authentication responses minimize institution data by role", () => {
  assert.match(core, /export const publicUser = \(user: Doc\) => \(\{ id: user\.id, name: user\.name, email: user\.email, role: user\.role, active: user\.active \}\)/);
  assert.doesNotMatch(core, /export const publicUser = [^\n]*institution_id/);
  assert.match(core, /export const publicInstitution = \(institution: Doc \| null\)/);
  assert.match(routes, /institution: publicInstitution\(institution\)/);
  assert.match(routes, /institution: publicInstitution\(loginInstitution\)/);
  assert.match(routes, /institution: publicInstitution\(institution\)/);
});

test("student and professional profile responses use the same institution contract", () => {
  assert.match(routes, /pathname === "\/api\/students\/me"[\s\S]*institution: publicInstitution\(/);
  assert.match(routes, /pathname === "\/api\/professionals\/me"[\s\S]*institution: publicInstitution\(/);
  assert.match(routes, /const publicStudentProfile = \(student: Doc\) => \(\{ id: student\.id, age_band: student\.age_band/);
  assert.match(routes, /pathname === "\/api\/students\/me"[\s\S]*student: publicStudentProfile\(student\)/);
});

test("capacity lookups stay scoped to the current institution", () => {
  assert.match(routes, /slot\.institution_id !== student\.institution_id/);
  assert.match(routes, /findOne\("professionals", \{ id: professionalId, institution_id: student\.institution_id \}\)/);
  assert.match(routes, /findOne\("availability", \{ id: availabilityId, professional_id: professional\.id, institution_id: professional\.institution_id \}\)/);
  assert.match(routes, /findOne\("requests", \{ id: fallbackId, institution_id: institution\.id, status: "pending" \}\)/);
});

test("rescheduling serializes source and target capacity operations", () => {
  assert.match(workerDb, /async reschedulePublishedRequest\(requestId: string, studentId: string, oldSlotId: string \| undefined, slot: RecordDoc/);
  const start = workerDb.indexOf("async reschedulePublishedRequest");
  const end = workerDb.indexOf("async approveMinorRegistration", start);
  const block = workerDb.slice(start, end);
  assert.match(block, /this\.withCapacityLocks\(\[String\(slot\.professional_id\), String\(oldProfessionalId \|\| slot\.professional_id\)\]/);
  assert.match(block, /oldSlotId\) await slots\.updateOne/);
});

test("pilot reset tokens require an explicit non-production environment", () => {
  assert.match(routes, /PILOT_RETURN_RESET_TOKEN === "true" && Boolean\(env\.APP_ENV\) && env\.APP_ENV !== "production"/);
});

test("archived institutions are rejected for existing sessions", () => {
  assert.match(core, /if \(user\.role !== "admin"\)/);
  assert.match(core, /Instituição arquivada\. Fale com a administração\./);
});

test("non-admin accounts require a valid institution link", () => {
  assert.match(core, /Instituição não vinculada\. Fale com a administração\./);
  assert.match(routes, /user\.role !== "admin" && !loginInstitution/);
});

test("certificates keep a manual validation code alongside the QR shortcut", () => {
  assert.match(professional, /Código: \$\{printable\.code\}/);
  assert.match(professional, /class="qr-code"/);
});

test("certificate storage has audit and lookup indexes", () => {
  assert.match(indexScript, /duplicateCodes/);
  assert.match(indexScript, /certificates\"\)\.createIndex\(\{ code: 1 \}, \{ unique: true, sparse: true \}\)/);
  assert.match(indexScript, /certificates\"\)\.createIndex\(\{ institution_id: 1, status: 1, issued_at: -1 \}\)/);
  assert.match(indexScript, /certificates\"\)\.createIndex\(\{ professional_id: 1, status: 1, issued_at: -1 \}\)/);
});

test("printed certificate values are escaped before HTML interpolation", () => {
  assert.match(professional, /const escapeHtml = value =>/);
  assert.match(professional, /const printable = \{ \.\.\.\(certificate \|\|/);
  assert.match(professional, /printable\.professional_name = escapeHtml\(printable\.professional_name\)/);
  assert.match(professional, /printable\.institution_name = escapeHtml\(printable\.institution_name\)/);
  assert.match(professional, /printable\.code = escapeHtml\(printable\.code\)/);
  assert.match(professional, /printable\.completed_count = Number\.isFinite\(Number\(printable\.completed_count\)\)/);
});

test("lead submissions validate delivery configuration before persisting", () => {
  const guard = 'if (!env.RESEND_API_KEY || !env.LEAD_EMAIL_TO) return fail("Envio de contatos ainda não está configurado", 503);';
  assert.ok(routes.indexOf(guard) >= 0);
  assert.ok(routes.indexOf(guard) < routes.indexOf('await db(env).createLead(lead)'));
});

test("persisted leads do not fail because secondary email delivery is unavailable", () => {
  assert.match(routes, /notification_pending: true/);
  assert.doesNotMatch(routes, /return fail\("Não foi possível enviar o contato agora", 502\)/);
});

test("external email integrations have a bounded timeout", () => {
  assert.match(routes, /AbortSignal\.timeout\(8_000\)/);
  assert.doesNotMatch(routes, /await fetch\("https:\/\/(?:api\.resend\.com|gmail\.googleapis\.com|oauth2\.googleapis\.com)/);
});

test("email adapters log a safe provider fallback without exposing credentials", () => {
  assert.match(routes, /logOperational\("email_provider_fallback"/);
  assert.match(routes, /failed_provider: "gmail"/);
  assert.match(routes, /fallback_available: Boolean\(env\.RESEND_API_KEY\)/);
  assert.doesNotMatch(routes, /console\.(log|warn|error).*GMAIL_CLIENT_SECRET/);
});

test("email delivery failures leave aggregate operational events", () => {
  assert.match(routes, /email_delivery_retry_scheduled/);
  assert.match(routes, /email_delivery_failed/);
  assert.match(routes, /notification_id: String\((?:created|notification)\.id\)/);
  assert.doesNotMatch(routes, /email_delivery_failed[\s\S]{0,300}recipient_user_id/);
});

test("technical email events have bounded partial retention", () => {
  assert.match(indexScript, /technical_email_events_retention/);
  assert.match(indexScript, /expireAfterSeconds: 180 \* 24 \* 60 \* 60/);
  assert.match(indexScript, /email_delivery_retry_scheduled/);
  assert.match(indexScript, /email_delivery_failed/);
});

test("realtime broadcasts have a bounded timeout", () => {
  assert.match(core, /realtime\.internal\/realtime\/broadcast[\s\S]*AbortSignal\.timeout\(3_000\)/);
});

test("dashboard notification badges use the authoritative unread count", () => {
  assert.match(routes, /notification_unread_count: notificationPage\.unread_count \|\| 0/);
  assert.match(shell, /dashboardNotificationUnreadCount/);
  assert.match(student, /notificationUnreadCount/);
  assert.match(professional, /notificationUnreadCount/);
});

test("chat read receipts are broadcast only after persistence", () => {
  assert.match(workerDb, /let persisted = false/);
  assert.match(workerDb, /persisted = changed\.modifiedCount === 1/);
  assert.match(workerDb, /if \(persisted\) this\.broadcast\(\{ sessionId: metadata\.sessionId, event: \{ type: "message_read"/);
});

test("chat and notification requests have a bounded client timeout", () => {
  assert.match(realtime, /timeout: 15_000/);
});

test("realtime websocket upgrades have a bounded server timeout", () => {
  assert.match(workerIndex, /realtime\.internal\/realtime\/socket[\s\S]*AbortSignal\.timeout\(5_000\)/);
});

test("realtime websocket upgrades validate the browser origin", () => {
  const start = workerIndex.indexOf("async function realtimeUpgrade");
  const end = workerIndex.indexOf("export default", start);
  const block = workerIndex.slice(start, end);
  assert.match(block, /request\.headers\.get\("origin"\)/);
  assert.match(block, /origin !== env\.FRONTEND_URL/);
});

test("realtime websocket messages have a per-socket rate limit", () => {
  assert.match(workerDb, /inboundWindows = new Map<WebSocket/);
  assert.match(workerDb, /window\.count > 120/);
  assert.match(workerDb, /this\.inboundWindows\.delete\(socket\)/);
});

test("network timeouts use a user-facing message", () => {
  assert.match(realtime, /A conexão demorou demais\. Tente novamente\./);
});

test("chat fallback polling pauses while the tab is hidden", () => {
  assert.match(student, /refreshWhenVisible = \(\) => \{ if \(document\.visibilityState === "visible"\) refreshChat\(\); \}/);
  assert.match(professional, /refreshWhenVisible = \(\) => \{ if \(document\.visibilityState === "visible"\) refreshChat\(\); \}/);
});

test("opening a chat leaves message loading to the session effect", () => {
  assert.match(student, /setChatMessages\(\[\]\);[\s\S]*?setChatSession\(sessionId\);/);
  assert.match(professional, /setChatMessages\(\[\]\);[\s\S]*?setChatSession\(sessionId\);/);
  assert.match(student, /const refreshChat = async \(\) =>[\s\S]*?refreshChat\(\);/);
  assert.match(professional, /const refreshChat = async \(\) =>[\s\S]*?refreshChat\(\);/);
  assert.match(student, /Carregando mensagens…/);
  assert.match(professional, /Carregando mensagens…/);
  assert.match(student, /let active = true;[\s\S]*?if \(!active\) return;[\s\S]*?active = false/);
  assert.match(professional, /let active = true;[\s\S]*?if \(!active\) return;[\s\S]*?active = false/);
  assert.match(student, /\[chatMessages, chatRealtimeConnected, chatSession\]/);
  assert.match(professional, /\[chatMessages, chatRealtimeConnected, chatSession\]/);
  assert.match(student, /setChatOnline\(false\);[\s\S]*?setChatTyping\(false\);[\s\S]*?setChatReadAt\(null\);/);
  assert.match(professional, /setChatOnline\(false\);[\s\S]*?setChatTyping\(false\);[\s\S]*?setChatReadAt\(null\);/);
  assert.match(student, /chatSessionRef\.current === sessionId/);
  assert.match(professional, /chatSessionRef\.current === sessionId/);
  assert.match(student, /if \(!connected\) \{[\s\S]*?setChatOnline\(false\);[\s\S]*?setChatTyping\(false\); \}/);
  assert.match(professional, /if \(!connected\) \{[\s\S]*?setChatOnline\(false\);[\s\S]*?setChatTyping\(false\); \}/);
  assert.match(student, /lastReadSentRef\.current !== readKey/);
  assert.match(professional, /lastReadSentRef\.current !== readKey/);
});

test("dashboard refresh stays centralized in the MVP shell", () => {
  assert.doesNotMatch(student, /setInterval\(refreshWhenVisible, 300000\)/);
  assert.doesNotMatch(professional, /setInterval\(refreshWhenVisible, 300000\)/);
  assert.match(shell, /window\.setInterval\(refreshWhenVisible, 300_000\)/);
});

test("response SLA is framed as an operational pilot target", () => {
  const disclaimer = /meta operacional do piloto, não uma garantia/;
  assert.match(frontendInstitution, disclaimer);
  assert.match(operations, disclaimer);
  assert.match(pilotEvidence, disclaimer);
  assert.match(operations, /48 horas corridas/);
  assert.match(operations, /America\/Fortaleza/);
});

test("institution operations expose capacity, manual fallback and onboarding", () => {
  assert.match(routes, /capacity_open_slots/);
  assert.match(routes, /request_fallback_reviewed/);
  assert.match(routes, /onboarding_steps/);
  assert.match(frontendInstitution, /inst-capacity-card/);
  assert.match(frontendInstitution, /inst-fallback-card/);
  assert.match(frontendInstitution, /inst-onboarding-card/);
  assert.match(frontendInstitution, /offer_other_professional/);
});

test("institution impact reports support a baseline and safe export", () => {
  assert.match(routes, /impact_baseline/);
  assert.match(routes, /impact_baseline_captured/);
  assert.match(routes, /buildImpactReport/);
  assert.match(frontendInstitution, /inst-capture-baseline/);
  assert.match(frontendInstitution, /inst-export-impact/);
  assert.match(frontendInstitution, /relatorio-impacto-acolhe\.csv/);
  assert.match(frontendInstitution, /const csvCell = value =>/);
  assert.match(frontendInstitution, /\^\[=\+\\-@\]/);
  assert.match(routes, /period_start/);
  assert.match(routes, /population/);
  assert.match(frontendInstitution, /Variação observada/);
  assert.match(frontendInstitution, /sem identificadores/);
  assert.match(frontendInstitution, /baselineBusy/);
  assert.match(frontendInstitution, /População observada/);
  assert.match(frontendInstitution, /window\.setTimeout\(\(\) => URL\.revokeObjectURL/);
  assert.match(shell, /aria-live=\{ariaLive\}/);
});

test("standalone controls declare button type", async () => {
  const notificationBell = await readFile(resolve(root, "src/components/NotificationBell.jsx"), "utf8");
  const themeToggle = await readFile(resolve(root, "src/components/ThemeToggle.jsx"), "utf8");
  const onboarding = await readFile(resolve(root, "src/components/Onboarding.jsx"), "utf8");
  const palette = await readFile(resolve(root, "src/components/CommandPalette.jsx"), "utf8");
  assert.doesNotMatch(notificationBell, /<button className=/);
  assert.match(themeToggle, /<button\s+type="button"/);
  assert.doesNotMatch(onboarding, /<button className=/);
  assert.match(palette, /<button type="button"/);
});

test("admin lead and certificate actions cannot submit unrelated forms", async () => {
  const adminSource = await readFile(resolve(root, "src/mvp/AdminArea.jsx"), "utf8");
    assert.doesNotMatch(adminSource, /<button className="button small/);
  assert.match(adminSource, /<button type="button" className="button small/);
});

test("route changes reset the page scroll position", async () => {
  const appSource = await readFile(resolve(root, "src/App.js"), "utf8");
  assert.match(appSource, /useLayoutEffect\(\(\) => \{[\s\S]*?window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
  assert.match(appSource, /const main = document\.querySelector\("main"\)/);
  assert.match(appSource, /main\.focus\(\{ preventScroll: true \}\)/);
  assert.match(appSource, /focusIsDocumentBody/);
  assert.match(appSource, /focusIsDetached = Boolean\(active && !active\.isConnected\)/);
  assert.match(appSource, /focusIsEditing = Boolean\(active\?\.matches\?\./);
  assert.match(appSource, /active\?\.tagName === "A" \|\| active\?\.tagName === "BUTTON"/);
  assert.match(appSource, /\}, \[location\.pathname, location\.search\]\);/);
});

test("standalone legacy buttons get safe non-submit semantics", async () => {
  const appSource = await readFile(resolve(root, "src/App.js"), "utf8");
  assert.match(appSource, /querySelectorAll\("button:not\(\[type\]\)"\)/);
  assert.match(appSource, /if \(!button\.form\) button\.type = "button"/);
});

test("authentication errors are announced to assistive technology", async () => {
  const files = ["src/mvp/LoginPage.jsx", "src/mvp/RegisterPage.jsx", "src/mvp/InvitePage.jsx", "src/mvp/PasswordPages.jsx"];
  for (const file of files) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.match(source, /className="mvp-error"[^>]*role="alert"/);
    assert.match(source, /aria-live="assertive"/);
  }
});

test("authentication loading state is announced to assistive technology", async () => {
  const app = await readFile(resolve(root, "src/App.js"), "utf8");
  const auth = await readFile(resolve(root, "src/mvp/AuthMvp.jsx"), "utf8");
  assert.match(app, /className="mvp-loading" role="status" aria-live="polite" aria-busy="true"/);
  assert.match(auth, /className="mvp-loading" role="status" aria-live="polite" aria-busy="true"/);
});

test("professional mutations guard against duplicate submissions", async () => {
  const professional = await readFile(resolve(root, "src/mvp/ProfessionalArea.jsx"), "utf8");
  assert.match(professional, /const actionBusyRef = useRef\(false\)/);
  assert.match(professional, /if \(actionBusyRef\.current\) return/);
  assert.match(professional, /actionBusyRef\.current = true/);
  assert.match(professional, /actionBusyRef\.current = false/);
  assert.match(professional, /disabled=\{actionBusy\}/);
});

test("student mutations guard against duplicate submissions", async () => {
  const student = await readFile(resolve(root, "src/mvp/StudentArea.jsx"), "utf8");
  assert.match(student, /const actionBusyRef = useRef\(false\)/);
  assert.match(student, /if \(!appointmentProfessional \|\| actionBusyRef\.current\) return/);
  assert.ok((student.match(/if \(actionBusyRef\.current\) return/g) || []).length >= 4);
  assert.ok((student.match(/actionBusyRef\.current = false/g) || []).length >= 5);
});

test("admin mutations guard against duplicate submissions", async () => {
  const admin = await readFile(resolve(root, "src/mvp/AdminArea.jsx"), "utf8");
  assert.match(admin, /const busyActionRef = useRef\(false\)/);
  assert.match(admin, /if \(busyActionRef\.current\) return/);
  assert.match(admin, /busyActionRef\.current = true/);
  assert.match(admin, /busyActionRef\.current = false/);
});

test("institution mutations guard against duplicate submissions", async () => {
  const institution = await readFile(resolve(root, "src/mvp/InstitutionArea.jsx"), "utf8");
  assert.match(institution, /const mutationBusyRef = useRef\(false\)/);
  assert.ok((institution.match(/mutationBusyRef\.current\) return/g) || []).length >= 4);
  assert.ok((institution.match(/mutationBusyRef\.current = true/g) || []).length >= 5);
  assert.ok((institution.match(/mutationBusyRef\.current = false/g) || []).length >= 5);
});

test("notification panel announces pagination loading", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shell, /aria-busy=\{notificationsLoading \|\| notificationPage\.loading\}/);
});

test("public assets receive a compatible content security policy", async () => {
  const worker = await readFile(resolve(root, "../cloudflare-worker/src/index.ts"), "utf8");
  assert.match(worker, /content-security-policy/);
  assert.match(worker, /script-src 'self'/);
  assert.match(worker, /connect-src 'self' wss:/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /env\.ASSETS\.fetch\(request\)/);
  assert.match(worker, /max-age=31536000, immutable/);
  const wrangler = await readFile(resolve(root, "../cloudflare-worker/wrangler.jsonc"), "utf8");
  assert.match(wrangler, /"run_worker_first": true/);
});

test("the public healthcheck supports monitor-friendly HEAD requests", async () => {
  const worker = await readFile(resolve(root, "../cloudflare-worker/src/index.ts"), "utf8");
  assert.match(worker, /\["\/api\/live", "\/api\/ready", "\/api\/health"\]/);
  assert.match(worker, /\["GET", "HEAD"\]\.includes\(request\.method\)/);
  assert.match(worker, /request\.method === "HEAD"/);
});

test("the public shell keeps bootstrap behavior compatible with CSP", async () => {
  const html = await readFile(resolve(root, "index.html"), "utf8");
  const bootstrap = await readFile(resolve(root, "public/bootstrap.js"), "utf8");
  assert.match(html, /<script src="\/bootstrap\.js"><\/script>/);
  assert.doesNotMatch(html, /<script>\s*\(/);
  assert.match(bootstrap, /acolhe-theme/);
  assert.match(bootstrap, /PerformanceServerTiming/);
});

test("overlay panels move focus to their close actions", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shell, /notificationCloseRef\.current\?\.focus\(\)/);
  assert.match(shell, /conversationCloseRef\.current\?\.focus\(\)/);
  assert.match(shell, /ref=\{notificationCloseRef\}/);
  assert.match(shell, /ref=\{conversationCloseRef\}/);
});

test("overlay panels restore focus to their launch controls", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shell, /notificationTriggerRef\.current\?\.focus\(\)/);
  assert.match(shell, /conversationTriggerRef\.current\?\.focus\(\)/);
  assert.match(shell, /ref=\{notificationTriggerRef\}/);
  assert.match(shell, /ref=\{conversationTriggerRef\}/);
});

test("MVP overlays keep keyboard focus contained", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  const lock = await readFile(resolve(root, "src/overlayScrollLock.js"), "utf8");
  assert.match(shell, /notificationRef\.current\?\.querySelector\("\.mvp-notification-panel"\)/);
  assert.match(shell, /launcherRef\.current\?\.querySelector\("\.mvp-conversation-panel"\)/);
  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /aria-modal="false"/);
  assert.match(shell, /import \{ lockOverlayScroll \} from "\.\.\/overlayScrollLock"/);
  assert.match(lock, /activeLocks === 0/);
  assert.match(lock, /document\.body\.style\.overflow = "hidden"/);
  assert.match(lock, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(lock, /let released = false/);
  assert.match(lock, /if \(released\) return/);
  assert.match(shell, /return lockOverlayScroll\(\)/g);
});

test("command palette restores focus after closing", async () => {
  const command = await readFile(resolve(root, "src/components/CommandPalette.jsx"), "utf8");
  assert.match(command, /returnFocusRef = useRef\(null\)/);
  assert.match(command, /returnFocusRef\.current = document\.activeElement/);
  assert.match(command, /returnFocusRef\.current\.focus\(\{ preventScroll: true \}\)/);
});

test("corner quick access keeps keyboard focus inside its panel", async () => {
  const app = await readFile(resolve(root, "src/App.js"), "utf8");
  assert.match(app, /dialogRef\.current/);
  assert.match(app, /dialog\.querySelectorAll\("a\[href\], button/);
  assert.match(app, /aria-modal="false"/);
});

test("main navigation has a stable accessible name", () => {
  assert.match(app, /<nav[^>]*aria-label="Menu principal"/);
});

test("mobile navigation locks background scroll while open", async () => {
  const app = await readFile(resolve(root, "src/App.js"), "utf8");
  const lock = await readFile(resolve(root, "src/overlayScrollLock.js"), "utf8");
  assert.match(app, /import \{ lockOverlayScroll \} from "\.\/overlayScrollLock"/);
  assert.match(app, /data-testid="mobile-menu-button"/);
  assert.match(app, /return lockOverlayScroll\(\)/);
  assert.match(lock, /activeLocks === 0/);
  assert.match(lock, /document\.body\.style\.overflow = "hidden"/);
});

test("interactive notification surfaces import their React hooks", async () => {
  const command = await readFile(resolve(root, "src/components/CommandPalette.jsx"), "utf8");
  const bell = await readFile(resolve(root, "src/components/NotificationBell.jsx"), "utf8");
  const onboarding = await readFile(resolve(root, "src/components/Onboarding.jsx"), "utf8");
  assert.match(command, /import \{ useEffect, useMemo, useRef, useState \} from "react"/);
  assert.match(command, /aria-modal="true"/);
  assert.match(command, /aria-label="Buscar páginas e profissionais"/);
  assert.match(bell, /import \{ useEffect, useId, useRef, useState \} from "react"/);
  assert.match(bell, /role="dialog"/);
  assert.match(bell, /import \{ lockOverlayScroll \} from "\.\.\/overlayScrollLock"/);
  assert.match(bell, /const unlockScroll = lockOverlayScroll\(\)/);
  assert.match(command, /import \{ lockOverlayScroll \} from "\.\.\/overlayScrollLock"/);
  assert.match(command, /const unlockScroll = lockOverlayScroll\(\)/);
  assert.match(onboarding, /import \{ lockOverlayScroll \} from "\.\.\/overlayScrollLock"/);
  assert.match(onboarding, /const unlockScroll = lockOverlayScroll\(\)/);
});

test("modal surfaces contain mobile scroll chaining", async () => {
  const css = await readFile(resolve(root, "src/App.css"), "utf8");
  assert.match(css, /\.onboarding-card \{[\s\S]*overscroll-behavior: contain/);
  assert.match(css, /\.command-panel \{[\s\S]*overscroll-behavior: contain/);
});

test("sync retry tolerates panels without a refresh callback", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shell, /if \(onRefresh\) Promise\.resolve\(\)\.then\(\(\) => onRefresh\(\)\)\.catch/);
  assert.doesNotMatch(shell, /onRefresh\?\.\(\)\.catch/);
});

test("background refresh tolerates synchronous refresh callbacks", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shell, /Promise\.resolve\(\)\.then\(\(\) => onRefresh\(\)\)\.catch/);
  assert.match(shell, /Promise\.resolve\(\)\.then\(\(\) => onRefresh\(\)\)\.then/);
});

test("background refresh also catches synchronous callback throws", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shell, /Promise\.resolve\(\)\.then\(\(\) => onRefresh\(\)\)/);
});

test("MVP auth provider imports every React hook it uses", async () => {
  const auth = await readFile(resolve(root, "src/mvp/AuthMvp.jsx"), "utf8");
  assert.match(auth, /import \{ createContext, useCallback, useContext, useEffect, useMemo, useState \} from "react"/);
});

test("booking persistence tolerates unavailable local storage", async () => {
  const booking = await readFile(resolve(root, "src/booking.js"), "utf8");
  assert.match(booking, /try \{ localStorage\.setItem\(KEY, JSON\.stringify\(state\)\); \}/);
  assert.match(booking, /catch \(e\) \{ \/\* armazenamento indisponível/);
});

test("student and professional action controls declare button type", async () => {
  const studentSource = await readFile(resolve(root, "src/mvp/StudentArea.jsx"), "utf8");
  const professionalSource = await readFile(resolve(root, "src/mvp/ProfessionalArea.jsx"), "utf8");
  for (const source of [studentSource, professionalSource]) {
    assert.doesNotMatch(source, /<button\s+className=/);
  }
  assert.match(studentSource, /<button type="button" aria-label="Enviar mensagem"/);
  assert.match(professionalSource, /<button type="button" aria-label="Enviar mensagem"/);
});

test("form actions declare submit semantics explicitly", async () => {
  const sources = await Promise.all([
    "src/mvp/MvpShell.jsx", "src/mvp/RegisterPage.jsx", "src/mvp/PasswordPages.jsx",
    "src/mvp/InvitePage.jsx", "src/mvp/LoginPage.jsx", "src/mvp/InstitutionArea.jsx", "src/mvp/AdminArea.jsx",
  ].map(file => readFile(resolve(root, file), "utf8")));
  for (const source of sources) assert.match(source, /type="submit"/);
});

test("optional browser storage never blocks the main experience", async () => {
  const app = await readFile(resolve(root, "src/App.js"), "utf8");
  const theme = await readFile(resolve(root, "src/theme.js"), "utf8");
  const api = await readFile(resolve(root, "src/mvp/api.js"), "utf8");
  assert.match(app, /try \{ return !localStorage\.getItem\("acolhe-onboarding"\); \} catch \{ return false; \}/);
  assert.match(app, /try \{ localStorage\.setItem\("acolhe-onboarding", "done"\); \} catch/);
  assert.match(theme, /try \{ return localStorage\.getItem\(KEY\) \|\| "system"; \} catch \{ return "system"; \}/);
  assert.match(theme, /try \{ localStorage\.setItem\(KEY, next\); \} catch/);
  assert.match(api, /export const clearToken = \(\) => \{ resetPendingGets\(\); try \{ localStorage\.removeItem/);
});

test("theme preference supports older browser media-query listeners", async () => {
  const theme = await readFile(resolve(root, "src/theme.js"), "utf8");
  assert.match(theme, /mq\.addEventListener\) .*mq\.addListener/);
  assert.match(theme, /mq\.removeEventListener\) .*mq\.removeListener/);
});

test("realtime connections close while hidden and resume safely", async () => {
  const realtime = await readFile(resolve(root, "src/mvp/api.js"), "utf8");
  assert.match(realtime, /document\.visibilityState === "hidden"\) \{ clearRetry\(\); if \(socket && \[WebSocket\.OPEN, WebSocket\.CONNECTING\]/);
  assert.match(realtime, /generation \+= 1/);
  assert.match(realtime, /if \(currentGeneration !== generation\) return/);
});

test("realtime retry timers are single-flight and sends tolerate closed sockets", async () => {
  const realtime = await readFile(resolve(root, "src/mvp/api.js"), "utf8");
  assert.match(realtime, /if \(stopped \|\| document\.visibilityState === "hidden" \|\| retryTimer\) return/);
  assert.match(realtime, /try \{ if \(currentSocket\.readyState === WebSocket\.OPEN\) currentSocket\.send/);
  assert.match(realtime, /retryTimer = window\.setTimeout\(\(\) => \{ retryTimer = undefined; connect\(\); \}, delay\)/);
});

test("dashboard refreshes ignore stale responses across protected roles", async () => {
  const files = ["src/mvp/StudentArea.jsx", "src/mvp/ProfessionalArea.jsx", "src/mvp/InstitutionArea.jsx", "src/mvp/AdminArea.jsx"];
  for (const file of files) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.match(source, /const loadRequestRef = useRef\(0\)/);
    assert.match(source, /const requestId = \+\+loadRequestRef\.current/);
    assert.match(source, /if \(requestId !== loadRequestRef\.current\) return/);
    assert.match(source, /if \(requestId === loadRequestRef\.current\) setLoading\(false\)/);
  }
});

test("notification refreshes ignore stale pages and cancel older pagination", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shell, /const notificationRequestRef = useRef\(0\)/);
  assert.match(shell, /const notificationMoreRequestRef = useRef\(0\)/);
  assert.match(shell, /const requestId = \+\+notificationRequestRef\.current/);
  assert.match(shell, /if \(requestId !== notificationRequestRef\.current\) return false/);
  assert.match(shell, /const requestId = \+\+notificationMoreRequestRef\.current/);
  assert.match(shell, /if \(requestId !== notificationMoreRequestRef\.current\) return;/);
  assert.match(shell, /\+\+notificationMoreRequestRef\.current;[\s\S]*setNotificationPage\(current => current\.loading/);
});

test("expanded chat and notifications use the dynamic mobile viewport", async () => {
  const css = await readFile(resolve(root, "src/mvp/mvp.css"), "utf8");
  assert.match(css, /max-height: min\(70dvh, 520px\)/);
  assert.match(css, /height: min\(576px, calc\(100dvh - 112px\)\)/);
  assert.match(css, /body:has\(\.mvp-conversation-window\) \{ overflow: hidden; \}/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /\.mvp-conversation-panel \{[^}]*overscroll-behavior: contain/);
});

test("backend notification fan-out deduplicates recipients", async () => {
  assert.match(routes, /async function notifyManyUsers/);
  assert.match(routes, /Promise\.allSettled\(recipients\.map/);
  assert.match(routes, /fanout:\$\{type\}:\$\{String\(stableKey\)\}:\$\{recipientId\}/);
  assert.match(routes, /const userIds = \[\.\.\.new Set\(students\.map\(student => String\(student\.user_id\)\)/);
  assert.match(routes, /const userIds = \[\.\.\.new Set\(students\.map\(student => String\(student\.user_id \|\| ""\)\)/);
});

test("intentional hidden-tab realtime pauses do not trigger fallback polling", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shell, /if \(typeof document !== "undefined" && document\.visibilityState === "hidden"\) return;/);
  assert.match(shell, /if \(status !== "error" && status !== "closed"\) return;[\s\S]*document\.visibilityState/);
});

test("closing the conversation list clears its selection so it can reopen", async () => {
  const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
  assert.match(shell, /onClick=\{\(\) => \{ setOpen\(false\); setSelectedId\(null\); \}\} aria-label="Fechar mensagens"/);
});

test("all dashboard loaders import the ref hook used for request ordering", async () => {
  const files = ["src/mvp/StudentArea.jsx", "src/mvp/ProfessionalArea.jsx", "src/mvp/InstitutionArea.jsx", "src/mvp/AdminArea.jsx"];
  for (const file of files) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.match(source, /useRef/);
  }
});

test("transient MVP auth failures preserve the current session", async () => {
  const auth = await readFile(resolve(root, "src/mvp/AuthMvp.jsx"), "utf8");
  assert.match(auth, /if \(\[401, 403\]\.includes\(e\?\.response\?\.status\)\)/);
  assert.doesNotMatch(auth, /catch \(e\) \{\s*setAccount\(null\);\s*clearToken\(\);/);
});

test("account privacy controls are shared by user panels but excluded from admin", () => {
  assert.ok(shell.includes('{user?.role !== "admin" && <AccountPrivacyCard'));
  assert.match(shell, /data-testid="account-privacy-card"/);
  assert.match(shell, /Excluir conta permanentemente/);
  assert.match(shell, /api\.delete\("\/auth\/account"/);
  assert.match(routes, /pathname === "\/api\/auth\/account" && request\.method === "DELETE"/);
  assert.match(routes, /user\.role === "admin"/);
  assert.match(routes, /store\.deleteAccount\(user\.id, \{ kind: "self" \}\)/);
  assert.match(routes, /store\.deleteAccount\(target\.id, \{ kind: "admin", adminId: admin\.id \}\)/);
  assert.match(workerDb, /session\.withTransaction\(async \(\) =>/);
  assert.match(workerDb, /deleteMany\(filter, \{ session \}\)/);
  assert.match(workerDb, /session\.endSession\(\)/);
});

test("admin audit excludes technical email delivery events from operational feed and counts", () => {
  assert.match(routes, /const TECHNICAL_EVENT_TYPES = \["email_delivery_retry_scheduled", "email_delivery_failed"\]/);
  assert.match(routes, /TECHNICAL_EVENT_TYPES/);
  assert.match(routes, /type: \{ \$nin: \[\.\.\.TECHNICAL_EVENT_TYPES\] \}/);
  assert.doesNotMatch(routes, /findMany\("events", \{\}, \{ projection: \{ type: 1, role: 1, institution_id: 1, created_at: 1 \}/);
  assert.match(admin, /TECHNICAL_AUDIT_TYPES = new Set\(\["email_delivery_retry_scheduled", "email_delivery_failed"\]\)/);
  assert.match(admin, /const auditPage = Array\.isArray\(auditResponse\.data\) \? \{ items: auditResponse\.data, has_more: false, next_before: null \} : auditResponse\.data/);
  assert.match(admin, /setAuditEvents\(\(auditPage\?\.items \|\| \[\]\)\.filter\(event => !TECHNICAL_AUDIT_TYPES\.has\(event\?\.type\)\)/);
});

test("administrative metrics and audit routes share the admin-only guard", () => {
  const adminRouteStart = routes.indexOf("async function adminRoutes");
  assert.ok(adminRouteStart >= 0);
  const adminRouteSource = routes.slice(adminRouteStart, routes.indexOf("async function", adminRouteStart + 1) > 0 ? routes.indexOf("async function", adminRouteStart + 1) : routes.length);
  assert.match(adminRouteSource, /const admin = await userWithRole\(request, env, \["admin"\]\)/);
  assert.match(adminRouteSource, /pathname === "\/api\/admin\/audit"/);
  assert.match(adminRouteSource, /pathname === "\/api\/metrics\/global"/);
});

test("role guard returns forbidden for a valid session with the wrong role", () => {
  assert.match(core, /if \(!roles\.includes\(user\.role as Role\)\) return fail\("Perfil sem permissão para esta operação", 403\)/);
  assert.match(core, /const user = await currentUser\(request, env\);/);
});

test("worker errors do not echo provider or exception details", async () => {
  assert.doesNotMatch(routes, /fail\([^\n]*error\??\.message/);
  assert.doesNotMatch(routes, /fail\([^\n]*String\(error\)/);
  assert.match(routes, /logOperational\("request_acceptance_failed"/);
  assert.match(routes, /Não foi possível confirmar a conversa\. Tente novamente\./);
  assert.match(routes, /logOperational\("professional_invitation_failed"/);
  assert.match(routes, /Não foi possível criar o convite\. Verifique o e-mail e tente novamente\./);
  assert.match(workerIndex, /logOperational\("api_unhandled_error", \{ method: request\.method, route: url\.pathname, error_name:/);
  assert.match(workerIndex, /logOperational\("realtime_upgrade_failed", \{ method: request\.method, route: url\.pathname, error_name:/);
  assert.match(workerDb, /logOperational\("chat_read_receipt_persistence_failed"/);
  assert.doesNotMatch(routes, /console\.error\([^\n]*, error\)/);
  assert.match(operations, /Logs de erro e retenção/);
  assert.match(operations, /nunca tokens, senhas, conteúdo de conversa/);
  assert.match(operations, /Mensagens e abuso de tráfego/);
  assert.match(operations, /limite de 30 envios por usuário e conversa a cada 60 segundos/);
  assert.match(operations, /frames acima de 16 KiB/);
  assert.match(workerDb, /message\.byteLength\) > 16 \* 1024/);
  assert.match(workerDb, /window\.count > 120/);
  assert.match(pilotEvidence, /Evidência\/link.*referência interna sanitizada/);
  assert.match(pilotEvidence, /nunca cole URL de convite, token, link de sala/);
  assert.match(pilotEvidence, /Não registrar texto de conversa, senha, token, link de acesso/);
  const checklist = await readFile(resolve(root, "..", "docs", "PILOT-E2E-CHECKLIST.md"), "utf8");
  assert.match(checklist, /Se qualquer etapa falhar, interromper o roteiro/);
  assert.match(checklist, /Registrar somente IDs anonimizados, horários, status HTTP/);
  assert.match(checklist, /nunca registrar senha, token, texto de conversa/);
});

test("release status distinguishes published state from local changes", () => {
  assert.match(releaseStatus, /Última publicação autorizada: ciclo \d+/);
  assert.ok(currentPublishedVersion);
  assert.match(releaseStatus, new RegExp(currentPublishedVersion.replaceAll("-", "\\-")));
  assert.match(releaseStatus, /Alterações locais posteriores não são consideradas parte desta versão/);
  assert.match(releaseStatus, /novo smoke test/);
});

test("release smoke gate checks both health methods and security headers", () => {
  assert.match(smokeScript, /\/api\/health/);
  assert.match(smokeScript, /-Method Head/);
  assert.match(smokeScript, /Strict-Transport-Security/);
  assert.match(smokeScript, /Content-Security-Policy/);
  assert.match(smokeScript, /database -ne "ok"/);
  assert.match(smokeScript, /assetMatch = \[regex\]::Match/);
  assert.match(smokeScript, /referenced build asset is unavailable or missing immutable cache\/nosniff/);
});

test("public health payload stays operational and does not expose database details", () => {
  assert.match(workerIndex, /const base = \{ service: "acolhe", environment: env\.APP_ENV \|\| "production", checked_at/);
  assert.match(workerIndex, /\["\/api\/live", "\/api\/ready", "\/api\/health"\]/);
  assert.doesNotMatch(workerIndex, /health[^\n]*MONGO_URL/);
  assert.doesNotMatch(workerIndex, /health[^\n]*DB_NAME/);
});

test("public CORS stays bound to the configured frontend origin", () => {
  assert.match(workerIndex, /return origin === env\.FRONTEND_URL \? origin : undefined/);
  assert.match(workerIndex, /if \(!origin\) return new Response\(null, \{ status: 403 \}\)/);
  assert.match(workerIndex, /function withAssetSecurity/);
  assert.match(workerIndex, /access-control-allow-headers.*authorization, content-type/);
  assert.match(workerIndex, /access-control-allow-methods.*GET, POST, PUT, PATCH, DELETE, OPTIONS/);
  assert.match(workerIndex, /access-control-max-age.*86400/);
});

test("worker JSON input has a bounded body size before parsing", () => {
  assert.match(core, /const MAX_JSON_BODY_BYTES = 256 \* 1024/);
  assert.match(core, /contentLength.*MAX_JSON_BODY_BYTES/);
  assert.match(core, /raw\.byteLength > MAX_JSON_BODY_BYTES/);
});

test("notification and audit pagination stay bounded", () => {
  assert.match(core, /findMany\("notifications", filter, \{ sort: \{ created_at: -1, id: -1 \}, limit: 41 \}\)/);
  assert.match(routes, /Math\.min\(50, Math\.max\(1, Math\.floor\(requestedLimit\)\)\)/);
});

test("admin dashboard list projections stay minimized and bounded", () => {
  assert.match(routes, /projection: \{ password_hash: 0, invite_token: 0, invite_expires_at: 0, session_version: 0 \}/);
  assert.match(routes, /projection: \{ reason_note: 0 \}.*limit: 500/);
  assert.match(routes, /projection: \{ note: 0, reason_note: 0 \}.*limit: 500/);
  assert.match(routes, /const adminSafeRequest =/);
});

test("admin institution listings use an explicit operational allowlist", () => {
  assert.match(routes, /async function adminInstitutions\([\s\S]*?\.map\(\(institution\) => \(\{ id: institution\.id, name: institution\.name, code: institution\.code/);
  assert.doesNotMatch(routes, /adminInstitutions[\s\S]*?\.map\(\(institution\) => \(\{ \.\.\.institution/);
});

test("invite tokens stay scoped to the institution invitation response", () => {
  assert.match(routes, /store\.findMany\("users", \{ id: \{ \$in: userIds \} \}, \{ projection: \{ id: 1, name: 1, email: 1, active: 1, invite_token: 1 \}/);
  assert.match(routes, /invite_path: account\?\.invite_token \? `\/convite\/\$\{account\.invite_token\}` : null/);
  assert.match(routes, /projection: \{ password_hash: 0, invite_token: 0, invite_expires_at: 0, session_version: 0 \}/);
});

test("institution invitation routes require the linked institution session", () => {
  assert.match(routes, /async function getInstitution\([\s\S]*?userWithRole\(request, env, \["institution"\]\)/);
  assert.match(routes, /findOne\("institutions", \{ id: user\.institution_id \}\)/);
  assert.match(routes, /pathname === "\/api\/institutions\/me\/professionals"/);
});

test("notification history and unread counts stay scoped to the recipient", () => {
  assert.match(core, /const baseFilter: Doc = \{ recipient_user_id: recipientUserId \}/);
  assert.match(core, /findMany\("notifications", filter/);
  assert.match(core, /count\("notifications", \{ \.\.\.baseFilter, read: \{ \$ne: true \} \}\)/);
});

test("bulk notification reads stay scoped to the current recipient", () => {
  assert.match(routes, /updateMany\("notifications", \{ recipient_user_id: user\.id, id: \{ \$in: ids \} \}/);
  assert.match(routes, /updateMany\("notifications", \{ recipient_user_id: admin\.id, id: \{ \$in: ids \} \}/);
});

test("release verifier keeps sensitive and local artifacts out of packages", () => {
  assert.match(verifyRelease, /cloudflare-worker\/\.dev\.vars\.example/);
  assert.match(verifyRelease, /\.edge-shot/);
  assert.match(verifyRelease, /\.pytest_cache/);
  assert.match(verifyRelease, /\.env/);
  assert.match(verifyRelease, /sqlite3/);
});

test("periodic uptime monitoring checks no-store and nosniff headers", () => {
  assert.match(uptimeWorkflow, /--head \"\$base\/api\/health\"/);
  assert.match(uptimeWorkflow, /cache-control:\.\*no-store/);
  assert.match(uptimeWorkflow, /x-content-type-options:\.\*nosniff/);
  assert.match(operations, /ACOLHE_BASE_URL/);
  assert.match(operations, /falha explicitamente/);
  assert.match(operations, /Configure notificações do repositório/);
  assert.match(uptimeWorkflow, /timeout-minutes: 2/);
  assert.match(uptimeWorkflow, /cancel-in-progress: true/);
});

test("realtime session identifiers are URL encoded", () => {
  assert.match(realtime, /encodeURIComponent\(sessionId\)/);
});

test("realtime heartbeat closes stale sockets", () => {
  assert.match(realtime, /lastPongAt = Date\.now\(\)/);
  assert.match(realtime, /heartbeat timeout/);
  assert.match(realtime, /Date\.now\(\) - lastPongAt >= 8_000/);
});

test("api client has a bounded request timeout", () => {
  assert.match(realtime, /timeout: 15_000/);
});

test("api errors do not expose provider details", () => {
  assert.match(realtime, /temporariamente indisponível/);
  assert.match(realtime, /Não foi possível concluir/);
  assert.doesNotMatch(realtime, /error\.response\.data\.stack/);
});

test("visibility handling does not leave duplicate realtime listeners", () => {
  assert.match(realtime, /document\.addEventListener\("visibilitychange", resumeWhenVisible\)/);
  assert.match(realtime, /document\.removeEventListener\("visibilitychange", resumeWhenVisible\)/);
});

test("heartbeat sends only on an open socket", () => {
  assert.match(realtime, /currentSocket\.readyState !== WebSocket\.OPEN/);
});

test("pending GET deduplication remains bounded", () => {
  assert.match(realtime, /const MAX_PENDING_GETS = 256/);
  assert.match(realtime, /pendingGets\.size >= MAX_PENDING_GETS/);
});

test("logout clears pending requests and local session residue", () => {
  assert.match(realtime, /export const clearToken = \(\) => \{ resetPendingGets\(\)/);
  assert.match(realtime, /localStorage\.removeItem\("acolhe-mvp-token"\)/);
});

test("api mutations keep credentials and JSON semantics", () => {
  assert.match(realtime, /withCredentials: true/);
  assert.match(realtime, /Content-Type.*application\/json/);
});

test("realtime ignores malformed frames without breaking the socket", () => {
  assert.match(realtime, /JSON\.parse\(event\.data\)/);
  assert.match(realtime, /catch \{ \/\* ignora eventos inválidos \*\//);
});

test("realtime status reports transport failures without exception details", () => {
  assert.match(realtime, /onStatus\?\.\("error"\)/);
  assert.match(realtime, /catch \{ onStatus\?\.\("error"\); scheduleRetry\(\); \}/);
});

test("institution impact exports remain aggregate and formula-safe", () => {
  assert.match(frontendInstitution, /Exportar CSV agregado/);
  assert.match(frontendInstitution, /Dados agregados; sem identificadores/);
  assert.match(frontendInstitution, /safe\.replaceAll\('"', '""'\)/);
  assert.doesNotMatch(frontendInstitution, /guardian_email.*relatorio-impacto/);
});

test("public shell headers prevent stale HTML caching", () => {
  assert.match(staticHeaders, /Strict-Transport-Security: max-age=31536000/);
  assert.match(staticHeaders, /X-Content-Type-Options: nosniff/);
  assert.match(staticHeaders, /\/index\.html[\s\S]*Cache-Control: no-store/);
});

test("public asset security policy keeps scripts same-origin", () => {
  assert.match(workerIndex, /content-security-policy/);
  assert.match(workerIndex, /script-src 'self'/);
  assert.doesNotMatch(workerIndex, /script-src[^;]*unsafe-inline/);
  assert.match(workerIndex, /object-src 'none'/);
  assert.match(workerIndex, /frame-ancestors 'none'/);
});

test("production build keeps vendor and feature chunks split", () => {
  assert.match(viteConfig, /manualChunks\(id\)/);
  for (const chunk of ["react", "icons", "feedback", "charts", "motion", "radix", "institutional", "mvp"]) assert.match(viteConfig, new RegExp(`return \"${chunk}\"`));
});

test("frontend exposes a budget check for the initial JavaScript chunk", () => {
  assert.match(frontendPackage, /"check:budget": "node \.\.\/ops\/check-frontend-budget\.mjs build\/assets"/);
  assert.match(frontendBudgetScript, /maxInitialChunkBytes = 250_000/);
});

test("professional search has an accessible label", () => {
  assert.match(app, /aria-label="Pesquisar profissionais"[^>]*data-testid="professional-search-input"/);
});

test("calendar and session icon controls have accessible names", () => {
  assert.match(app, /aria-label="Semana anterior"[^>]*data-testid="previous-week"/);
  assert.match(app, /aria-label="Próxima semana"[^>]*data-testid="next-week"/);
  assert.match(app, /aria-label="Fechar sala"[^>]*data-testid="close-session"/);
});

test("student waiting status stays readable on narrow screens", () => {
  assert.match(student, /Aguardando profissional/);
  assert.match(mvpCss, /student-active-appointment-card[\s\S]*overflow-wrap: break-word/);
  assert.match(mvpCss, /student-active-appointment-card[\s\S]*word-break: normal/);
  assert.match(mvpCss, /student-active-appointment-card[\s\S]*min-height: 40px/);
});

test("authenticated empty cards keep mobile spacing compact", () => {
  assert.match(mvpCss, /mvp-card\.compact-empty-card[\s\S]*padding: 16px/);
  assert.match(mvpCss, /mvp-card\.compact-empty-card \.mvp-card-head[\s\S]*margin-bottom: 10px/);
  assert.match(mvpCss, /mvp-card\.compact-empty-card \.mvp-empty[\s\S]*line-height: 1\.45/);
});

test("pending student requests use a direct next-step message", () => {
  assert.match(routes, /Aguardando o profissional responder\./);
  assert.doesNotMatch(routes, /Aguardando resposta do profissional\./);
});

test("authenticated load errors stay compact and actionable on mobile", () => {
  assert.match(mvpCss, /mvp-load-error[\s\S]*padding: 20px/);
  assert.match(mvpCss, /mvp-load-error \.button[\s\S]*min-height: 44px/);
  assert.match(shell, /MvpLoadError[\s\S]*Tentar novamente/);
});

test("sync warnings stack their recovery action on mobile", () => {
  assert.match(mvpCss, /mvp-sync-warning[\s\S]*display: grid/);
  assert.match(mvpCss, /mvp-sync-warning button[\s\S]*min-height: 40px/);
  assert.match(shell, /mvp-sync-warning[\s\S]*Atualizar/);
});

test("notification errors keep retry actions readable on mobile", () => {
  assert.match(mvpCss, /mvp-notification-error \{ display: grid/);
  assert.match(mvpCss, /mvp-notification-error button \{ justify-self: start; min-height: 36px/);
});

test("long notification copy breaks naturally on mobile", () => {
  assert.match(mvpCss, /mvp-notification-item-title \{[\s\S]*overflow-wrap: break-word/);
  assert.match(mvpCss, /mvp-notification-item small \{ min-width: 0; overflow-wrap: break-word/);
});

test("mobile notification panels keep a breathing gap below the header", () => {
  assert.match(mvpCss, /mvp-notification-panel,[\s\S]*top: calc\(var\(--mvp-topbar-height, 72px\) \+ env\(safe-area-inset-top\) \+ 8px\)/);
  assert.match(mvpCss, /mvp-notification-panel,[\s\S]*max-height: calc\(100dvh - var\(--mvp-topbar-height, 72px\) - 28px/);
  assert.match(mvpCss, /\.mvp-notification-item-title \{[\s\S]*overflow-wrap: break-word/);
});

test("long information pages keep mobile point sections breathable", () => {
  assert.match(appCss, /\.info-point \{ gap: 8px; padding: 24px 0; \}/);
  assert.match(appCss, /\.info-point h2 \{ font-size: 22px; line-height: 1\.2; \}/);
  assert.match(appCss, /\.info-point p \{ line-height: 1\.55; \}/);
});

test("FAQ and comparison cards keep mobile density balanced", () => {
  assert.match(appCss, /\.faq-item button \{ min-height: 50px; padding: 14px; \}/);
  assert.match(appCss, /\.faq-item p \{ margin: 0 14px 16px; line-height: 1\.55; \}/);
  assert.match(appCss, /\.compare-card \{ padding: 20px; border-radius: 20px; \}/);
});

test("public footer keeps mobile height under control", () => {
  assert.match(appCss, /\.footer \{ padding-top: 32px; \}/);
  assert.match(appCss, /\.footer-main \{ gap: 20px; \}/);
  assert.match(appCss, /\.footer-group \{ min-width: calc\(50% - 6px\); \}/);
});

test("wide authenticated panels do not stay artificially zoomed", () => {
  assert.match(mvpCss, /@media \(min-width: 1200px\)[\s\S]*professional-area[\s\S]*zoom: 1;/);
});

test("admin metric labels keep a balanced desktop rhythm", () => {
  assert.match(mvpCss, /admin-operational-metrics-card \.mvp-kpi-label \{[\s\S]*line-height: 1\.35;[\s\S]*text-wrap: balance/);
});

test("admin secondary cards keep desktop headings compact", () => {
  assert.match(mvpCss, /admin-secondary-card \.mvp-card-head h2 \{[\s\S]*font-size: 20px;[\s\S]*line-height: 1\.2/);
  assert.match(mvpCss, /admin-secondary-card \.mvp-card-head p \{[\s\S]*line-height: 1\.45/);
});

test("desktop notification panel has breathing room", () => {
  assert.match(mvpCss, /@media \(min-width: 901px\)[\s\S]*\.mvp-notification-panel\.is-expanded \{ gap: 10px; padding: 16px; \}/);
});

test("public footer controls keep a visible keyboard focus ring", () => {
  assert.match(appCss, /\.footer-links a:focus-visible, \.footer-cookie-settings:focus-visible/);
});

test("notification filters keep a visible keyboard focus ring", () => {
  assert.match(mvpCss, /\.mvp-notification-filters button:focus-visible/);
});

test("notification panel heading keeps a readable line height", () => {
  assert.match(mvpCss, /\.mvp-notification-panel-head strong \{ line-height: 1\.25; \}/);
});

test("notification item titles keep a readable line height", () => {
  assert.match(mvpCss, /\.mvp-notification-item-title \{ line-height: 1\.3; \}/);
});

test("notification item copy keeps a breathable line height", () => {
  assert.match(mvpCss, /\.mvp-notification-item small, \.mvp-notification-panel > small[\s\S]*line-height: 1\.45/);
});

test("mobile notification typography keeps the refined line heights", () => {
  assert.match(mvpCss, /\.mvp-notification-item-title \{ overflow-wrap: break-word; word-break: normal; line-height: 1\.3; \}/);
  assert.match(mvpCss, /\.mvp-notification-item small \{ overflow-wrap: break-word; word-break: normal; line-height: 1\.45; \}/);
});

test("mobile flow steps keep a breathable line height", () => {
  assert.match(mvpCss, /\.mvp-flow li \{ font-size: 11px; line-height: 1\.35; \}/);
});

test("mobile flow keeps horizontal scroll breathing room", () => {
  assert.match(mvpCss, /\.mvp-flow \{[\s\S]*scroll-padding-inline: 8px;/);
});

test("notification timestamps stay readable", () => {
  assert.match(mvpCss, /\.mvp-notification-item time \{[\s\S]*font-size: 11px; line-height: 1\.3/);
});

test("notification errors keep readable copy spacing", () => {
  assert.match(mvpCss, /\.mvp-notification-error \{[\s\S]*font-size: 11px; line-height: 1\.45/);
});

test("notification pagination keeps readable line height", () => {
  assert.match(mvpCss, /\.mvp-notification-view-all \{[\s\S]*line-height: 1\.3/);
});

test("auth headings keep balanced wrapping", () => {
  assert.match(mvpCss, /\.mvp-auth-card h1 \{[\s\S]*text-wrap: balance/);
});

test("auth intro copy stays readable", () => {
  assert.match(mvpCss, /\.mvp-auth-card > p \{ max-width: 42ch; font-size: 14px; line-height: 1\.5/);
});

test("auth footer copy keeps readable line height", () => {
  assert.match(mvpCss, /\.mvp-auth-foot \{[\s\S]*font-size: 13px; line-height: 1\.4/);
});

test("auth primary actions keep a comfortable target", () => {
  assert.match(mvpCss, /\.mvp-auth-card \.mvp-form > button \{ min-height: 46px; justify-content: center; \}/);
});

test("form labels keep a readable line height", () => {
  assert.match(mvpCss, /\.mvp-form label \{ display: grid; gap: 6px; font-size: 13px; line-height: 1\.35/);
});

test("form fields keep a comfortable target height", () => {
  assert.match(mvpCss, /\.mvp-form input, \.mvp-form select, \.mvp-form textarea \{ width: 100%; min-height: 44px/);
});

test("admin filters keep a readable line height", () => {
  assert.match(mvpCss, /\.admin-filter-bar button \{[\s\S]*font-size: 11px; line-height: 1\.3/);
});

test("admin filters keep labels together", () => {
  assert.match(mvpCss, /\.admin-filter-bar button \{[\s\S]*white-space: nowrap/);
});

test("admin row actions keep a consistent gap", () => {
  assert.match(mvpCss, /\.mvp-shell\[data-testid="admin-area"\] \.mvp-row-actions \{[\s\S]*gap: 8px/);
});

test("institution readiness notes keep balanced wrapping", () => {
  assert.match(mvpCss, /institution-readiness small \{[\s\S]*text-wrap: balance/);
});

test("institution operation rows keep readable line height", () => {
  assert.match(mvpCss, /institution-operations-grid \.mvp-row \{[\s\S]*line-height: 1\.35/);
});

test("institution operation headings keep balanced wrapping", () => {
  assert.match(mvpCss, /institution-operations-grid \.mvp-card-head h2 \{[\s\S]*line-height: 1\.2;[\s\S]*text-wrap: balance/);
});

test("professional session names keep readable line height", () => {
  assert.match(mvpCss, /professional-sessions-card \.professional-session-row \.mvp-row-main strong \{ line-height: 1\.3; \}/);
});

test("professional session metadata keeps readable line height", () => {
  assert.match(mvpCss, /professional-sessions-card \.professional-session-row \.mvp-row-main span \{ line-height: 1\.4; \}/);
});

test("professional room disclosure keeps readable line height", () => {
  assert.match(mvpCss, /professional-room-link summary \{ min-height: 42px; display: flex; align-items: center; line-height: 1\.3; \}/);
});

test("student request timeline keeps readable line height", () => {
  assert.match(mvpCss, /\.student-request-timeline \{[\s\S]*font-size: 12px; line-height: 1\.35/);
});

test("student request timeline labels keep balanced wrapping", () => {
  assert.match(mvpCss, /\.student-request-timeline span \{ position: relative; text-wrap: balance; \}/);
});

test("student history disclosure keeps readable line height", () => {
  assert.match(mvpCss, /\.student-history-card > summary \{ line-height: 1\.35; \}/);
});

test("student active status keeps readable line height", () => {
  assert.match(mvpCss, /student-active-appointment-card \.student-direct-request \.mvp-row-actions > \.mvp-tag \{[\s\S]*line-height: 1\.3/);
});

test("mobile empty card headings keep balanced wrapping", () => {
  assert.match(mvpCss, /mvp-card\.compact-empty-card \.mvp-card-head h2 \{[\s\S]*line-height: 1\.2;[\s\S]*text-wrap: balance/);
});

test("mobile empty card copy keeps a comfortable measure", () => {
  assert.match(mvpCss, /mvp-card\.compact-empty-card \.mvp-empty \{[\s\S]*max-width: 48ch/);
});

test("authenticated header badges keep stable height", () => {
  assert.match(mvpCss, /\.mvp-pill, \.mvp-role \{ font-size: 11px; line-height: 1\.25[\s\S]*white-space: nowrap/);
});

test("authenticated header badges do not shrink unexpectedly", () => {
  assert.match(mvpCss, /\.mvp-topbar-right > \.mvp-pill, \.mvp-topbar-right > \.mvp-role \{ flex: 0 0 auto; align-self: center; \}/);
});

test("message launcher keeps a stable label", () => {
  assert.match(mvpCss, /\.mvp-conversation-trigger \{[\s\S]*line-height: 1\.25; font-weight: 700; white-space: nowrap/);
});

test("message launcher count stays centered", () => {
  assert.match(mvpCss, /\.mvp-conversation-trigger b \{[\s\S]*font-size: 11px; line-height: 1\.1/);
});

test("mobile message launcher stays inside the viewport", () => {
  assert.match(mvpCss, /\.mvp-conversation-trigger \{ min-height: 42px; max-width: calc\(100vw - 28px\); padding: 0 13px/);
});

test("public footer intro keeps breathable line height", () => {
  assert.match(appCss, /\.footer-main p \{ font-size: 13px; line-height: 1\.6/);
});

test("home mockup keeps mobile rendering lightweight", () => {
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.home-route \.hero-product \.blob-a,[\s\S]*filter: none; box-shadow: none/);
  assert.match(css, /\.home-route \.hero-product \.mark-scene \{ will-change: auto; \}/);
  assert.match(css, /\.home-route > main > section:not\(\.hero\) \{[\s\S]*content-visibility: auto/);
});

test("student dashboard defers history and cancels stale loads", () => {
  assert.match(student, /dashboard\?summary=1/);
  assert.match(student, /new AbortController\(\)/);
  assert.match(student, /appointment-requests/);
});

test("professional certificate does not block the agenda", () => {
  assert.match(professional, /Certificate eligibility is secondary/);
  assert.match(professional, /api\.get\("\/professionals\/me\/certificate"\)/);
});

test("admin secondary sections load after the operational summary", () => {
  assert.match(admin, /operational summary is the critical path/);
  assert.match(admin, /void Promise\.all\(\[api\.get\("\/admin\/analytics"/);
});
