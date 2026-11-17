import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const app = await readFile(resolve(root, "src/App.js"), "utf8");
const css = await readFile(resolve(root, "src/mobile.css"), "utf8");
const mvpCss = await readFile(resolve(root, "src/mvp/mvp.css"), "utf8");
const shell = await readFile(resolve(root, "src/mvp/MvpShell.jsx"), "utf8");
const authMvp = await readFile(resolve(root, "src/mvp/AuthMvp.jsx"), "utf8");
const student = await readFile(resolve(root, "src/mvp/StudentArea.jsx"), "utf8");
const professional = await readFile(resolve(root, "src/mvp/ProfessionalArea.jsx"), "utf8");
const register = await readFile(resolve(root, "src/mvp/RegisterPage.jsx"), "utf8");
const certificateValidation = await readFile(resolve(root, "src/mvp/CertificateValidationPage.jsx"), "utf8");
const admin = await readFile(resolve(root, "src/mvp/AdminArea.jsx"), "utf8");
const frontendInstitution = await readFile(resolve(root, "src/mvp/InstitutionArea.jsx"), "utf8");
const operations = await readFile(resolve(root, "..", "docs", "OPERATIONS.md"), "utf8");
const pilotEvidence = await readFile(resolve(root, "..", "docs", "PILOT-E2E-EVIDENCE.md"), "utf8");
const realtime = await readFile(resolve(root, "src/mvp/api.js"), "utf8");
const routes = await readFile(resolve(root, "..", "cloudflare-worker", "src", "routes.ts"), "utf8");
const core = await readFile(resolve(root, "..", "cloudflare-worker", "src", "core.ts"), "utf8");
const workerDb = await readFile(resolve(root, "..", "cloudflare-worker", "src", "db.ts"), "utf8");
const workerIndex = await readFile(resolve(root, "..", "cloudflare-worker", "src", "index.ts"), "utf8");
const staticHeaders = await readFile(resolve(root, "public", "_headers"), "utf8");
const home = app.slice(app.indexOf("function Home()"), app.indexOf("function InfoPage"));

test("home presents the current MVP rather than a rotating demo", () => {
  assert.match(home, /Acesso ao MVP/);
  assert.match(home, /Fluxo do MVP/);
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

test("primary home actions enter the MVP", () => {
  assert.match(home, /data-testid="hero-talk-button"/);
  assert.match(home, /to="\/entrar" className="button primary"/);
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
  assert.match(routes, /if \(pathname === "\/api\/admin\/users"/);
});

test("admin request listings exclude free-text student notes", () => {
  assert.match(routes, /findMany\("appointment_requests", \{\}, \{ projection: \{ note: 0, reason_note: 0 \}/);
  assert.match(routes, /findMany\("requests", \{\}, \{ projection: \{ reason_note: 0 \}/);
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

test("institution notifications exclude retired availability events from list and unread count", () => {
  const start = routes.indexOf('if (pathname === "/api/institutions/me/notifications"');
  const end = routes.indexOf('if (pathname === "/api/institutions/me/notifications/read"', start);
  assert.ok(start >= 0 && end > start);
  assert.match(routes.slice(start, end), /excludeTypes: \["availability_published", "availability_published_for_request"\]/);
  assert.match(core, /const unread_count = options\.includeUnreadCount[\s\S]*\.\.\.baseFilter, read: \{ \$ne: true \} \}/);
});

test("institution metrics expose response time and attendance without private content", () => {
  assert.match(routes, /response_time_minutes_avg/);
  assert.match(routes, /responses_within_48h/);
  assert.match(routes, /attendance_rate/);
  assert.match(frontendInstitution, /Tempo médio até resposta/);
  assert.match(frontendInstitution, /Comparecimento/);
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
  assert.match(routes, /APP_TIME_ZONE = "America\/Fortaleza"/);
  assert.match(routes, /scheduleTimestamp/);
  assert.match(routes, /localCurrentTime/);
});

test("completed sessions accept past calendar dates", () => {
  assert.match(routes, /validDateShape\(session\.date\).*session\.date < today/);
});

test("certificate visibility and revocation stay role-scoped", () => {
  assert.match(routes, /certificates\", \{ professional_id: \{ \$in: professionalIds \} \}/);
  assert.match(routes, /pathParameter\(pathname, "\/api\/admin\/certificates\/", "\/revoke"\)/);
  assert.match(routes, /findOne\("certificates", \{ code: certificateCode, status: "valid" \}\)/);
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
  assert.match(core, /export const publicInstitution = \(institution: Doc \| null\)/);
  assert.match(routes, /institution: publicInstitution\(institution\)/);
  assert.match(routes, /user\.role === "institution" \? loginInstitution : publicInstitution\(loginInstitution\)/);
  assert.match(routes, /user\.role === "institution" \? institution : publicInstitution\(institution\)/);
});

test("student and professional profile responses use the same institution contract", () => {
  assert.match(routes, /pathname === "\/api\/students\/me"[\s\S]*institution: publicInstitution\(/);
  assert.match(routes, /pathname === "\/api\/professionals\/me"[\s\S]*institution: publicInstitution\(/);
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

test("lead submissions validate delivery configuration before persisting", () => {
  const guard = 'if (!env.RESEND_API_KEY || !env.LEAD_EMAIL_TO) return fail("Envio de contatos ainda não está configurado", 503);';
  assert.ok(routes.indexOf(guard) >= 0);
  assert.ok(routes.indexOf(guard) < routes.indexOf('await db(env).insert("leads", lead)'));
});

test("persisted leads do not fail because secondary email delivery is unavailable", () => {
  assert.match(routes, /notification_pending: true/);
  assert.doesNotMatch(routes, /return fail\("Não foi possível enviar o contato agora", 502\)/);
});

test("external email integrations have a bounded timeout", () => {
  assert.match(routes, /AbortSignal\.timeout\(8_000\)/);
  assert.doesNotMatch(routes, /await fetch\("https:\/\/(?:api\.resend\.com|gmail\.googleapis\.com|oauth2\.googleapis\.com)/);
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
  assert.match(workerDb, /persisted = true/);
  assert.match(workerDb, /if \(persisted\) this\.broadcast\(\{ sessionId: metadata\.sessionId, event: \{ type: "message_read"/);
});

test("chat and notification requests have a bounded client timeout", () => {
  assert.match(realtime, /timeout: 15_000/);
});

test("realtime websocket upgrades have a bounded server timeout", () => {
  assert.match(workerIndex, /realtime\.internal\/realtime\/socket[\s\S]*AbortSignal\.timeout\(5_000\)/);
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
  assert.match(api, /export const clearToken = \(\) => \{ try \{ localStorage\.removeItem/);
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
  assert.match(routes, /const ids = \[\.\.\.new Set\(managers\.map/);
  assert.match(routes, /const ids = \[\.\.\.new Set\(admins\.map/);
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
