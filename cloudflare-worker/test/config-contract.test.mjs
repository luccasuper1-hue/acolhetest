import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const template = await readFile(new URL("../.dev.vars.example", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const frontendReadme = await readFile(new URL("../../frontend/README.md", import.meta.url), "utf8");
const rootReadme = await readFile(new URL("../../README.md", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const migration = await readFile(new URL("../../ops/migrations/backfill-certificate-institution.mjs", import.meta.url), "utf8");
const repairMigration = await readFile(new URL("../../ops/migrations/repair-institution-link.mjs", import.meta.url), "utf8");
const migrationsReadme = await readFile(new URL("../../ops/migrations/README.md", import.meta.url), "utf8");
const packager = await readFile(new URL("../../ops/package-release.ps1", import.meta.url), "utf8");
const releaseVerifier = await readFile(new URL("../../ops/verify-release.ps1", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const deployDoc = await readFile(new URL("../../DEPLOY.md", import.meta.url), "utf8");
const operationsDoc = await readFile(new URL("../../docs/OPERATIONS.md", import.meta.url), "utf8");
const onboardingDoc = await readFile(new URL("../../docs/ONBOARDING-INSTITUTION.md", import.meta.url), "utf8");
const privacyDoc = await readFile(new URL("../../docs/PRIVACY-GOVERNANCE.md", import.meta.url), "utf8");
const legalReadiness = await readFile(new URL("../../docs/LEGAL-READINESS-PILOT.md", import.meta.url), "utf8");
const smokeScript = await readFile(new URL("../../ops/smoke-test.ps1", import.meta.url), "utf8");
const e2eChecklist = await readFile(new URL("../../docs/PILOT-E2E-CHECKLIST.md", import.meta.url), "utf8");
const e2eEvidence = await readFile(new URL("../../docs/PILOT-E2E-EVIDENCE.md", import.meta.url), "utf8");
const incidentDoc = await readFile(new URL("../../docs/INCIDENT-DRILL-RESULTS.md", import.meta.url), "utf8");
const releaseStatus = await readFile(new URL("../../docs/RELEASE-STATUS.md", import.meta.url), "utf8");
const currentPublishedVersion = releaseStatus.match(/Versão do Worker: `([^`]+)`/)?.[1] || "";
const restoreScript = await readFile(new URL("../../ops/restore-mongodb.ps1", import.meta.url), "utf8");
const backupScript = await readFile(new URL("../../ops/backup-mongodb.ps1", import.meta.url), "utf8");
const backupWorkflow = await readFile(new URL("../../.github/workflows/mongodb-backup.yml", import.meta.url), "utf8");
const uptimeWorkflow = await readFile(new URL("../../.github/workflows/uptime.yml", import.meta.url), "utf8");
const qualityWorkflow = await readFile(new URL("../../.github/workflows/quality.yml", import.meta.url), "utf8");
const sitemap = await readFile(new URL("../../frontend/public/sitemap.xml", import.meta.url), "utf8");
const robots = await readFile(new URL("../../frontend/public/robots.txt", import.meta.url), "utf8");
const appSource = await readFile(new URL("../../frontend/src/App.js", import.meta.url), "utf8");
const workerIndex = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const routesSource = await readFile(new URL("../src/routes.ts", import.meta.url), "utf8");
const dbSource = await readFile(new URL("../src/db.ts", import.meta.url), "utf8");
const coreSource = await readFile(new URL("../src/core.ts", import.meta.url), "utf8");
const observabilitySource = await readFile(new URL("../src/observability.ts", import.meta.url), "utf8");
const privacySource = await readFile(new URL("../src/domains/privacy.ts", import.meta.url), "utf8");
const operationsSource = await readFile(new URL("../src/domains/operations.ts", import.meta.url), "utf8");
const governanceDoc = await readFile(new URL("../../docs/DATA-GOVERNANCE.md", import.meta.url), "utf8");
const retentionDoc = await readFile(new URL("../../docs/RETENTION-POLICY.md", import.meta.url), "utf8");
const processingDoc = await readFile(new URL("../../docs/PROCESSING-RECORD.md", import.meta.url), "utf8");
const authSource = await readFile(new URL("../src/auth.ts", import.meta.url), "utf8");
const loadScript = await readFile(new URL("../../ops/load-authenticated-staging.mjs", import.meta.url), "utf8");
const seedLoadScript = await readFile(new URL("../../ops/seed-authenticated-staging.mjs", import.meta.url), "utf8");
const loadDoc = await readFile(new URL("../../docs/LOAD-TEST-STAGING.md", import.meta.url), "utf8");

test("local vars template matches the Worker configuration contract", () => {
  for (const name of ["MONGO_URL", "DB_NAME", "JWT_SECRET", "FRONTEND_URL"]) {
    assert.match(template, new RegExp(`^${name}=`, "m"));
    assert.match(readme, new RegExp(`\\b${name}\\b`));
  }
  assert.doesNotMatch(template, /^MONGODB_URI=/m);
  assert.doesNotMatch(template, /^MONGODB_DB=/m);
  assert.equal(packageJson.scripts["migrate:certificates"], "node ../ops/migrations/backfill-certificate-institution.mjs");
  assert.match(readme, /npm run migrate:certificates/);
  assert.match(readme, /MONGODB_URI.*variável exclusiva do utilitário local/);
  assert.match(readme, /Cloudflare Worker/);
  assert.match(readme, /Durable Object/);
  assert.match(readme, /MongoDB Atlas/);
  assert.match(readme, /FastAPI.*legado\/local/);
  assert.match(frontendReadme, /Vite/);
  assert.match(rootReadme, /backend\/.*não é o caminho de produção/);
  assert.match(frontendReadme, /Vite/);
  assert.match(readme, /Worker oficial de produção/);
  assert.match(migration, /createRequire\(new URL\("\.\.\/\.\.\/cloudflare-worker\/package\.json"/);
  assert.match(repairMigration, /const databaseName = process\.env\.MONGODB_DB/);
  assert.match(repairMigration, /client\.db\(databaseName\)/);
  assert.match(repairMigration, /MONGODB_DB inválido/);
  assert.match(repairMigration, /TARGET_INSTITUTION_ID inválido/);
  assert.match(migrationsReadme, /repair-institution-link\.mjs.*MONGODB_URI.*MONGODB_DB.*PROFESSIONAL_USER_ID.*TARGET_INSTITUTION_ID/s);
  assert.match(packager, /\.dev\.vars\.example/);
  assert.doesNotMatch(packager, /\.dev\.vars\.example.*excludedFileNames/);
  assert.match(packager, /Template seguro ausente/);
  assert.match(packager, /O pacote não contém o template seguro/);
  for (const excluded of [".edge-shot", ".browser-profile", ".playwright", ".auth", ".wrangler", "node_modules", ".pytest_cache", "__pycache__"]) {
    assert.match(packager, new RegExp(`"${excluded.replaceAll(".", "\\.")}"`));
  }
  assert.match(packager, /\.sqlite3/);
  assert.match(packager, /\.db/);
  assert.match(packager, /credentials\?\|secrets\?/);
  assert.match(packager, /\[switch\]\$Force/);
  assert.match(packager, /O pacote já existe/);
  assert.match(template, /Nunca substitua estes valores por credenciais reais/);
  assert.doesNotMatch(wrangler, /"crons"\s*:/);
  assert.equal(packageJson.scripts.deploy, "npm run check && npm test && npm run build:frontend && wrangler deploy");
  assert.match(deployDoc, /Rollback seguro/);
  assert.match(deployDoc, /docs\/RELEASE-STATUS\.md/);
  assert.match(deployDoc, /Smoke test pós-publicação/);
  assert.match(deployDoc, /HEAD \/api\/health/);
  assert.match(restoreScript, /\[switch\]\$ConfirmDrop/);
  assert.match(restoreScript, /if \(-not \$ConfirmDrop\)/);
  assert.match(backupScript, /--gzip/);
  assert.match(backupScript, /--excludeCollection=login_attempts/);
  assert.match(backupScript, /MongoUri inválida/);
  assert.match(backupScript, /Database inválido/);
  assert.match(restoreScript, /MongoUri inválida/);
  assert.match(restoreScript, /Database inválido/);
  assert.match(restoreScript, /archiveItem\.Length -le 0/);
  assert.match(restoreScript, /\\\.archive\\\.gz/);
  assert.match(backupScript, /acolhe-\$stamp\.archive\.gz/);
  assert.match(backupWorkflow, /test -n "\$MONGODB_URI"/);
  assert.match(backupWorkflow, /test -n "\$MONGODB_DB"/);
  assert.match(backupWorkflow, /retention-days: \$\{\{ vars\.BACKUP_RETENTION_DAYS \|\| 14 \}\}/);
  assert.match(backupWorkflow, /permissions:\s+contents: read/);
  assert.match(backupWorkflow, /cron:\s+['"]17 3 \* \* \*['"]/);
  assert.match(backupWorkflow, /uses:\s+actions\/upload-artifact@v4/);
  assert.match(backupWorkflow, /path:\s+backup\/acolhe\.archive\.gz/);
  assert.match(backupWorkflow, /test -s backup\/acolhe\.archive\.gz/);
  assert.match(backupWorkflow, /if-no-files-found: error/);
  assert.match(backupWorkflow, /overwrite: false/);
  assert.match(backupWorkflow, /Report backup failure/);
  assert.match(backupWorkflow, /without exposing URI, database name or credentials/);
  assert.ok(backupWorkflow.indexOf("Report backup failure") < backupWorkflow.indexOf("Remove runner copy"));
  assert.match(backupWorkflow, /name:\s+acolhe-mongodb-\$\{\{ github\.run_id \}\}/);
  assert.match(backupWorkflow, /Remove runner copy/);
  assert.match(backupWorkflow, /if:\s+always\(\)/);
  assert.match(backupWorkflow, /rm -f backup\/acolhe\.archive\.gz/);
  assert.match(operationsDoc, /Verificação operacional sem abrir o conteúdo/);
  assert.match(operationsDoc, /ops\/verify-release\.ps1 -ZipPath/);
  assert.match(operationsDoc, /não comprova que um backup MongoDB é íntegro/);
  assert.match(operationsDoc, /docs\/RELEASE-STATUS\.md/);
  assert.match(e2eChecklist, /versão publicada em `docs\/RELEASE-STATUS\.md`/);
  assert.match(operationsDoc, /Não copie URI, nome de banco, senhas/);
  assert.match(operationsDoc, /Em chamados, use IDs anonimizados/);
  assert.match(onboardingDoc, /Ao pedir suporte, envie somente horário/);
  assert.match(privacyDoc, /No suporte e na auditoria operacional/);
assert.match(privacyDoc, /A política pública de privacidade deve apresentar essa mesma orientação/);
assert.match(privacyDoc, /Evitar frases que indiquem que essas regras ainda estão/);
  assert.match(operationsDoc, /Arquivos `\.archive\.gz` temporários devem ficar fora do repositório/);
  assert.match(smokeScript, /-TimeoutSec 20/);
  assert.match(smokeScript, /TryCreate\(\$BaseUrl/);
  assert.match(smokeScript, /UserInfo/);
  for (const required of ["DEPLOY\.md", "docs\/OPERATIONS\.md", "docs\/PILOT-E2E-CHECKLIST\.md", "ops\/smoke-test\.ps1", "cloudflare-worker\/\.dev\.vars\.example"]) {
    assert.match(releaseVerifier, new RegExp(required));
  }
  assert.match(releaseVerifier, /forbiddenPattern/);
  assert.match(releaseVerifier, /Pacote inválido: não foi possível abrir um ZIP/);
  assert.match(releaseVerifier, /refresh\[-_\]\?token.*client\[-_\]\?secret.*id_rsa.*oauth/);
  assert.match(releaseVerifier, /zip\|tar\|tgz\|log/);
  assert.match(releaseVerifier, /A-Za-z\]:\|\/\|\\/);
  assert.ok(releaseVerifier.includes("\\.\\.(?:/|$)"));
  assert.match(uptimeWorkflow, /ACOLHE_BASE_URL:\s+\$\{\{ vars\.ACOLHE_BASE_URL \}\}/);
  assert.match(uptimeWorkflow, /test -n "\$\{ACOLHE_BASE_URL:-\}"/);
  assert.match(uptimeWorkflow, /timeout-minutes: 2/);
  assert.match(uptimeWorkflow, /concurrency:\s+group: acolhe-uptime/);
  assert.doesNotMatch(uptimeWorkflow, /acolhetest\.luccasuper1\.workers\.dev/);
  assert.match(uptimeWorkflow, /curl .*--fail --silent --show-error --location(?: --retry 2 --retry-delay 2)? --max-time 20 "\$base\//);
  assert.match(uptimeWorkflow, /curl .*--fail --silent --show-error --location(?: --retry 2 --retry-delay 2)? --max-time 20 "\$base\/api\/health"/);
  assert.ok(uptimeWorkflow.includes("^https://[^/?#@]+$"));
  assert.match(uptimeWorkflow, /--proto '=https'/);
  assert.doesNotMatch(uptimeWorkflow, /echo "\$ACOLHE_BASE_URL"/);
  assert.match(qualityWorkflow, /release-package:/);
  assert.match(qualityWorkflow, /ops\/package-release\.ps1 -OutputPath/);
  assert.match(qualityWorkflow, /ops\/verify-release\.ps1 -ZipPath/);
  assert.match(workerIndex, /"cache-control": "no-store"/);
  assert.match(workerIndex, /"x-content-type-options": "nosniff"/);
  assert.match(workerIndex, /request\.method === "HEAD"/);
  assert.match(workerIndex, /operationalHealth\(request, env/);
  assert.match(workerIndex, /\["\/api\/live", "\/api\/ready", "\/api\/health"\]/);
  assert.match(workerIndex, /database = "unavailable"/);
  assert.match(workerIndex, /ready \? 200 : 503/);
  assert.doesNotMatch(workerIndex, /health\.message|error\.message/);
  assert.match(routesSource, /events_truncated: eventsTruncated/);
  assert.match(routesSource, /privacy_note: "Dados agregados; nenhum identificador individual é exibido\."/);
  assert.match(routesSource, /conversion_rate: conversionRate/);
  assert.match(routesSource, /Math\.min\(365, Math\.max\(1, requestedDays\)\)/);
  assert.match(routesSource, /limit: 5001/);
  assert.match(routesSource, /registrations\.slice\(0, 5000\)/);
  assert.match(routesSource, /if \(!pathname\.startsWith\("\/api\/admin\/"\) && pathname !== "\/api\/metrics\/global"\) return undefined;/);
  assert.match(routesSource, /userWithRole\(request, env, \["admin"\]\)/);
  assert.match(routesSource, /store\.findMany\("students", \{ institution_id: institutionId \}/);
  assert.match(routesSource, /store\.findMany\("requests", \{ institution_id: institutionId \}/);
  assert.match(routesSource, /store\.findMany\("appointment_requests", \{ institution_id: institutionId \}/);
  assert.match(routesSource, /minimum_sample_size: 5/);
  assert.match(routesSource, /metrics_note: hasData \?/);
  assert.match(routesSource, /Ainda não há dados operacionais suficientes/);
  assert.match(routesSource, /per_institution: perInstitution/);
  assert.doesNotMatch(routesSource, /return \{[^}]*per_institution[^}]*user_id/);
  assert.match(routesSource, /attendance_sample_size: closedSessions/);
  assert.match(routesSource, /professional_id: professional\.id, institution_id: professional\.institution_id, status: "valid"/);
  assert.match(routesSource, /institution_id: professional\.institution_id, institution_name/);
  assert.match(routesSource, /findOne\("certificates", \{ code: certificateCode, status: "valid" \}/);
  assert.doesNotMatch(routesSource, /certificate: \{[^}]*password|certificate: \{[^}]*email/);
  assert.match(routesSource, /findMany\("certificates", \{ institution_id: institution\.id, professional_id: \{ \$in: professionalIds \} \}/);
  assert.match(routesSource, /certificates: certificates\.map\(\(certificate\) => \(\{ id: certificate\.id/);
  assert.match(routesSource, /institution\.id, user\.id, validationMethod/);
  assert.match(dbSource, /institution_id: institutionId, meta: \{ student_user_id: userId, validation_method: validationMethod \}/);
  assert.match(dbSource, /guardian_review_status: "approved"/);
  assert.match(routesSource, /active: !isChild/);
  assert.match(routesSource, /if \(user\.active === false\) return fail\("Acesso desativado/);
  assert.match(routesSource, /pending_guardian: true/);
  assert.match(routesSource, /Intl\.DateTimeFormat\("en-CA", \{ timeZone: APP_TIME_ZONE/);
  assert.match(privacySource, /PRODUCT_TIME_ZONE = "America\/Fortaleza"/);
  assert.match(routesSource, /age < 0 \|\| age > 120/);
  assert.match(routesSource, /validDateShape\(birthDate\) \? ageOnDate\(birthDate\) : -1/);
  assert.match(routesSource, /const MAX_LOGIN_ATTEMPTS = 5/);
  assert.match(routesSource, /const LOCK_MINUTES = 15/);
  assert.match(routesSource, /finalizeLogin\(address, Boolean\(user && await verifyPassword/);
  assert.match(dbSource, /async createAvailabilityBatch\(/);
  assert.match(dbSource, /slots\.some\(other => other !== slot && overlap\(/);
  assert.match(dbSource, /existing\.some\(record => overlap\(/);
  assert.match(operationsDoc, /ops\/smoke-test\.ps1/);
  assert.match(deployDoc, /ops\/smoke-test\.ps1/);
  assert.match(deployDoc, /Rollback seguro[\s\S]*ops\/smoke-test\.ps1 -BaseUrl/);
  assert.match(deployDoc, /atualize juntos `docs\/RELEASE-STATUS\.md`, `docs\/INCIDENT-DRILL-RESULTS\.md` e `docs\/PILOT-E2E-EVIDENCE\.md`/);
  assert.match(incidentDoc, /Suítes locais revalidadas nesta auditoria: frontend com 308 testes/);
  assert.match(incidentDoc, /Worker com 80 testes/);
  assert.match(incidentDoc, /restore e E2E abaixo que mencionam staging são históricos/);
  assert.match(incidentDoc, /não registra URL de banco, credenciais, tokens/);
  assert.match(incidentDoc, /Horários parcialmente sobrepostos/);
  assert.match(incidentDoc, /Smoke test público reexecutado no ciclo 150/);
  assert.match(incidentDoc, /Também não anexar logs brutos, respostas completas de API/);
  assert.ok(currentPublishedVersion);
  assert.match(e2eEvidence, new RegExp(currentPublishedVersion.replaceAll("-", "\\-")));
  assert.match(e2eEvidence, /Resultado geral histórico: `aprovado`/);
  assert.match(e2eEvidence, /E2E autenticado da versão atual: `pendente`/);
  assert.match(e2eEvidence, /Evidências por etapa do registro histórico/);
  assert.match(releaseStatus, new RegExp(currentPublishedVersion.replaceAll("-", "\\-")));
  assert.match(rootReadme, /docs\/RELEASE-STATUS\.md/);
  assert.match(e2eEvidence, /ID da execução/);
  assert.match(e2eEvidence, /Fonte da versão confirmada: `docs\/RELEASE-STATUS\.md`/);
  assert.match(e2eEvidence, /não sobrescreva uma execução anterior/);
  assert.match(e2eEvidence, /Não cole logs brutos, respostas completas de API/);
  assert.match(incidentDoc, /Repetição\/idempotência após timeout/);
  assert.match(incidentDoc, /restore-mongodb\.ps1 -ConfirmDrop/);
  assert.match(incidentDoc, /somente após validar URI, banco e arquivo de staging/);
  assert.match(operationsDoc, /docs\/PILOT-E2E-CHECKLIST\.md/);
  assert.match(operationsDoc, /docs\/PILOT-E2E-EVIDENCE\.md/);
  assert.match(operationsDoc, /Não copie mensagens, credenciais/);
  assert.match(operationsDoc, /DEPLOY\.md.*docs\/OPERATIONS\.md.*PILOT-E2E-CHECKLIST\.md/);
  assert.match(operationsDoc, /ops\/smoke-test\.ps1.*cloudflare-worker\/\.dev\.vars\.example/);
  assert.match(e2eEvidence, /Smoke test técnico da versão publicada: `aprovado`/);
  assert.match(e2eEvidence, /Resultado geral histórico: `aprovado`/);
  assert.match(e2eEvidence, /Próxima ação: repetir o roteiro com uma instituição piloto real/);
  assert.match(smokeScript, /Cache-Control/);
  assert.match(smokeScript, /database -ne "ok"/);
  assert.match(smokeScript, /Strict-Transport-Security/);
  assert.match(smokeScript, /Content-Security-Policy/);
  assert.match(smokeScript, /X-Content-Type-Options.*nosniff/);
  assert.match(smokeScript, /health\.Headers\["X-Content-Type-Options"\]/);
  assert.match(smokeScript, /Permissions-Policy.*camera/);
  assert.match(e2eChecklist, /ops\/smoke-test\.ps1/);
  assert.match(e2eChecklist, /nunca registrar senha, token/);
  assert.match(e2eChecklist, /duas propostas parcialmente sobrepostas/);
  assert.match(e2eChecklist, /confirmar idempotência/);
  assert.match(e2eEvidence, /versão do Worker, data\/hora UTC/);
  assert.match(e2eEvidence, /não anexar exportações de banco/);
  assert.match(operationsDoc, /nunca usar URI ou banco de produção/);
  assert.match(operationsDoc, /ops\/smoke-test\.ps1/);
  assert.match(operationsDoc, /limite de 30 envios por usuário e conversa a cada 60 segundos/);
  assert.match(operationsDoc, /eventos JSON com `event`, `method`, `route`, `error_name`/);
  assert.doesNotMatch(operationsDoc, /Antes de ampliar o piloto, medir volume real e implementar um limite operacional no Worker\/Durable Object/);
  for (const source of [coreSource, dbSource, routesSource, workerIndex]) assert.doesNotMatch(source, /console\.(?:log|warn|error)/);
  assert.match(observabilitySource, /console\.error\(JSON\.stringify/);
  assert.match(observabilitySource, /OperationalField/);
  for (const source of [coreSource, dbSource, routesSource, workerIndex]) {
    assert.doesNotMatch(source, /logOperational\([^,\n]+,\s*\{[^}]*\b(?:email|password|token|cookie|(?:user|student|professional|institution)_id)\s*:/i);
  }
  assert.match(loadScript, /const password = process\.env\.LOAD_PASSWORD;/);
  assert.doesNotMatch(loadScript, /LoadTest!2026/);
  assert.match(loadScript, /LOAD_PREFIX e LOAD_PASSWORD/);
  assert.match(loadScript, /error instanceof Error \? error\.name : "unknown"/);
  assert.match(loadScript, /REQUEST_TIMEOUT_MS = 15_000/);
  assert.match(loadScript, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.match(seedLoadScript, /const password = process\.env\.LOAD_PASSWORD;/);
  assert.doesNotMatch(seedLoadScript, /LoadTest!2026/);
  assert.match(seedLoadScript, /MONGO_URI, LOAD_PREFIX e LOAD_PASSWORD/);
  assert.match(seedLoadScript, /MONGO_TIMEOUT_MS = 15_000/);
  assert.match(seedLoadScript, /serverSelectionTimeoutMS: MONGO_TIMEOUT_MS/);
  assert.match(seedLoadScript, /connectTimeoutMS: MONGO_TIMEOUT_MS/);
  assert.match(seedLoadScript, /socketTimeoutMS: MONGO_TIMEOUT_MS/);
  assert.match(loadDoc, /exigem `MONGO_URI` \(seed\), `LOAD_PREFIX` e `LOAD_PASSWORD`/);
  assert.match(loadDoc, /Não há senha padrão/);
  assert.match(loadDoc, /CLEANUP=1/);
});

test("governance documents define roles, retention and minimization", () => {
  assert.match(governanceDoc, /Controlador/);
  assert.match(governanceDoc, /Operador/);
  assert.match(governanceDoc, /Suboperadores/);
  assert.match(governanceDoc, /pendentes de validação jurídica/);
  assert.match(retentionDoc, /Mensagens de conversa/);
  assert.match(retentionDoc, /Backups/);
  assert.match(processingDoc, /Analytics público/);
  assert.match(processingDoc, /Não permitido/);
});

test("public sitemap stays aligned with the deployed frontend origin", () => {
  const frontendOrigin = wrangler.match(/"FRONTEND_URL":\s*"([^\"]+)"/)?.[1];
  assert.ok(frontendOrigin);
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(sitemapUrls.length >= 5);
  for (const url of sitemapUrls) {
    assert.ok(url === frontendOrigin || url.startsWith(`${frontendOrigin}/`));
  }
  assert.ok(sitemapUrls.includes(`${frontendOrigin}/`));
  for (const route of ["/politica-de-cookies", "/ajuda/instituicoes", "/preciso-ajuda", "/termos/estudante", "/termos/profissional", "/termos/instituicao"]) {
    assert.ok(sitemapUrls.includes(`${frontendOrigin}${route}`));
  }
  for (const route of ["/como-funciona", "/para-estudantes", "/profissionais", "/instituicoes", "/privacidade", "/recursos", "/ajuda", "/termos"]) {
    assert.match(appSource, new RegExp(`path=\"${route.replaceAll("/", "\\/")}\"`));
    assert.ok(sitemapUrls.includes(`${frontendOrigin}${route}`));
  }
  assert.match(robots, new RegExp(`Sitemap:\\s*${frontendOrigin}/sitemap\\.xml`));
});

test("session cookies keep browser security attributes", () => {
  assert.match(coreSource, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(coreSource, /Max-Age=604800/);
  assert.match(coreSource, /Path=\//);
  assert.match(coreSource, /clearCookie = \(\) =>/);
});

test("logout and account deletion clear the session cookie", () => {
  assert.match(routesSource, /\/api\/auth\/logout.*clearCookie\(\)/);
  assert.match(routesSource, /deleted: true.*clearCookie\(\)/);
});

test("access tokens enforce an explicit algorithm and bounded lifetime", () => {
  assert.match(authSource, /algorithms: \["HS256"\]/);
  assert.match(authSource, /setExpirationTime\("7d"\)/);
  assert.match(authSource, /payload\.type !== "access"/);
});

test("login attempts are throttled and locked temporarily", () => {
  assert.match(routesSource, /const MAX_LOGIN_ATTEMPTS = 5/);
  assert.match(routesSource, /const LOCK_MINUTES = 15/);
  assert.match(routesSource, /finalizeLogin\(address, Boolean\(user && await verifyPassword/);
  assert.match(routesSource, /Muitas tentativas\. Tente novamente em alguns minutos\.", 429/);
});

test("password reset tokens are hashed, short-lived and single-use", () => {
  assert.match(routesSource, /token_hash: await hashToken\(resetToken\)/);
  assert.match(routesSource, /expires_at: isoAfter\(1, "hours"\)/);
  assert.match(routesSource, /used: false/);
  assert.match(routesSource, /used: true/);
});

test("password recovery does not enumerate accounts", () => {
  assert.match(routesSource, /Se o e-mail existir, as instruções de redefinição serão enviadas/);
  assert.match(routesSource, /if \(!user\) return json\(generic\)/);
  assert.match(routesSource, /PILOT_RETURN_RESET_TOKEN === "true"/);
  assert.match(routesSource, /APP_ENV !== "production"/);
});

test("password reset invalidates older sessions", () => {
  assert.match(routesSource, /session_version: Number\(user\.session_version \|\| 0\) \+ 1/);
  assert.match(routesSource, /scope: "session_invalidated"/);
});

test("password recovery keeps one active token per account", () => {
  assert.match(dbSource, /findOne\("password_reset_tokens", \{ user_id: userId \}/);
  assert.match(dbSource, /update\("password_reset_tokens", \{ user_id: userId \}/);
  assert.match(dbSource, /true\);/);
});

test("professional invitations expire and respect archived institutions", () => {
  assert.match(routesSource, /invite_expires_at: isoAfter\(14, "days"\)/);
  assert.match(routesSource, /Convite expirado\. Peça um novo à instituição\./);
  assert.match(routesSource, /Instituição arquivada\. Fale com a administração\./);
});

test("invite preview does not echo the invitation secret", () => {
  assert.match(routesSource, /return json\(\{ name: user\.name, email: user\.email, role: user\.role, institution: institution\?\.name \}\)/);
  assert.doesNotMatch(routesSource, /return json\(\{[^\n]*invite_token/);
});

test("student registration records versioned consent and age band", () => {
  assert.match(routesSource, /consent_version: consentVersion/);
  assert.match(routesSource, /consent_accepted_at: now\(\)/);
  assert.match(routesSource, /age_band: ageBandFor\(age\)/);
  assert.match(privacySource, /return age < CHILD_AGE_LIMIT \? "child" : age < 18 \? "adolescent" : "adult"/);
  assert.match(routesSource, /guardian_review_status: isChild \? "pending_institution_review"/);
});

test("child registration remains blocked until institutional review", () => {
  assert.match(routesSource, /active: !isChild/);
  assert.match(routesSource, /if \(isChild\)/);
  assert.match(routesSource, /pending_guardian: true/);
  assert.match(routesSource, /return json\(\{ pending_guardian: true, message:/);
});

test("minor approval is institution-scoped and role-protected", () => {
  assert.match(routesSource, /async function institutionRoutes/);
  assert.match(routesSource, /userWithRole\(request, env, \["institution"\]\)/);
  assert.match(routesSource, /institution_id: institution\.id, role: "student", age_band: "child"/);
  assert.match(routesSource, /approveMinorRegistration\(minorApprovalId, institution\.id, user\.id/);
});

test("minor guardian contact minimization is documented", () => {
  assert.match(privacyDoc, /disponíveis apenas para a instituição vinculada/);
  assert.match(privacyDoc, /painel administrativo global não deve exibir/);
});

test("institution dashboard collections stay bounded", () => {
  assert.match(routesSource, /findMany\("professionals", \{ institution_id: institution\.id \}.*limit: 200/);
  assert.match(routesSource, /findMany\("requests", \{ institution_id: institution\.id, status: "pending" \}.*limit: 100/);
  assert.match(routesSource, /guardian_review_status: "pending_institution_review".*limit: 100/);
  assert.match(routesSource, /findMany\("certificates", \{ institution_id: institution\.id/);
});

test("Mongo gateway clamps every collection read to a hard limit", () => {
  assert.match(dbSource, /const MAX_QUERY_LIMIT = 5_000/);
  assert.match(dbSource, /Math\.min\(MAX_QUERY_LIMIT, Math\.max\(1, Math\.trunc\(requestedLimit\)\)\)/);
  assert.match(dbSource, /limit \}\);/);
});

test("REST chat writes enforce the per-user conversation rate limit", () => {
  assert.match(dbSource, /allowChatMessage\(userId: string, sessionId: string/);
  assert.match(dbSource, /maxMessages = 30, windowMs = 60_000/);
  assert.match(routesSource, /store\.allowChatMessage\(user\.id, studentChatId\)/);
  assert.match(routesSource, /store\.allowChatMessage\(user\.id, professionalChatId\)/);
  assert.match(routesSource, /retry-after/);
  assert.match(operationsDoc, /30 envios por usuário e conversa/);
});

test("admin audit exposes a bounded cursor contract", () => {
  assert.match(routesSource, /pathname === "\/api\/admin\/audit"/);
  assert.match(routesSource, /const before = params\.get\("before"\) \|\| ""/);
  assert.match(routesSource, /limit: limit \+ 1/);
  assert.match(routesSource, /has_more: events\.length > items\.length/);
  assert.match(routesSource, /next_before: last \? `\$\{last\.created_at\}\|\$\{last\.id\}`/);
});

test("Mongo gateway narrows duplicate-key errors without any catches", () => {
  assert.match(dbSource, /const isDuplicateKeyError = \(error: unknown\)/);
  assert.doesNotMatch(dbSource, /catch \(error: any\)/);
});

test("authenticated load runner keeps staging mass bounded", () => {
  assert.match(loadScript, /studentCount = Number\(process\.env\.STUDENT_USERS \|\| 30\)/);
  assert.match(loadScript, /studentCount > 500/);
  assert.match(loadScript, /entre 1 e 500/);
});

test("admin dashboard collections stay bounded", () => {
  assert.match(routesSource, /findMany\("users".*limit: 500/);
  assert.match(routesSource, /findMany\("requests".*limit: 500/);
  assert.match(routesSource, /findMany\("appointment_requests".*limit: 500/);
  assert.match(routesSource, /findMany\("leads".*limit: 200/);
  assert.match(routesSource, /findMany\("certificates".*limit: 500/);
});

test("admin user projections stay free of auth and guardian secrets", () => {
  assert.match(routesSource, /password_hash: 0, invite_token: 0, invite_expires_at: 0, session_version: 0/);
  assert.match(routesSource, /const adminSafeUser = \(user: Doc/);
  assert.doesNotMatch(routesSource, /const adminSafeUser[\s\S]*guardian_email/);
});

test("admin request payloads stay operational and omit private notes", () => {
  assert.match(routesSource, /const adminSafeRequest = \(record: Doc/);
  assert.match(routesSource, /reason_code: record\.reason_code \|\| null/);
  assert.doesNotMatch(routesSource, /const adminSafeRequest = [^\n]*reason_note/);
  assert.doesNotMatch(routesSource, /const adminSafeRequest = [^\n]*note:/);
});

test("uptime monitoring validates health without dumping response bodies", () => {
  assert.match(uptimeWorkflow, /health=\"\$\(curl/);
  assert.match(uptimeWorkflow, /echo \"\$health\" \| grep -q '\"ok\":true'/);
  assert.match(uptimeWorkflow, /base\/api\/health.*\/dev\/null/);
  assert.match(uptimeWorkflow, /--retry 2 --retry-delay 2/);
  assert.match(uptimeWorkflow, /robots_type=.*content_type/);
  assert.match(uptimeWorkflow, /robots\.txt must be text\/plain/);
  assert.match(uptimeWorkflow, /robots\.txt.*Sitemap:/s);
  assert.match(uptimeWorkflow, /sitemap_type=.*content_type/);
  assert.match(uptimeWorkflow, /sitemap\.xml must be XML/);
  assert.match(uptimeWorkflow, /sitemap\.xml.*<loc>\$base\//s);
});

test("public analytics input stays consent-gated and bounded", () => {
  assert.match(routesSource, /consent_version\) !== "v1"/);
  assert.match(routesSource, /measurement_consent !== true/);
  assert.match(routesSource, /\^\[a-zA-Z0-9_-\]\{16,100\}\$/);
  assert.match(routesSource, /page = string\(payload\?\.page\)\.slice\(0, 120\)/);
});

test("public analytics deduplicates by visitor, page and day", () => {
  assert.match(dbSource, /recordAnalyticsPageView/);
  assert.match(dbSource, /page_view_keys/);
  assert.match(dbSource, /MAX_ANALYTICS_KEYS_PER_DAY/);
  assert.match(dbSource, /withAuthLock\(`analytics:\$\{day\}:\$\{pageKey\}`/);
});

test("analytics retention and query window stay bounded", () => {
  assert.match(legalReadiness, /Retenção de analytics/);
  assert.match(legalReadiness, /366 dias/);
  assert.match(routesSource, /limit: 366/);
});

test("session guard rejects stale versions and archived institutions", () => {
  assert.match(coreSource, /user\.session_version.*claims\.session_version/);
  assert.match(coreSource, /Sessão expirada\. Entre novamente\./);
  assert.match(coreSource, /institution\.active === false/);
});

test("dashboard expiration scans are deduplicated per institution", () => {
  assert.match(routesSource, /const expirationRuns = new Map/);
  assert.match(routesSource, /EXPIRATION_DEDUP_MS = 30_000/);
  assert.match(routesSource, /expirePendingRequestsWork\(store, env, institutionId\)/);
});

test("Mongo gateway reuses a bounded pool and releases idle sockets", () => {
  assert.match(dbSource, /minPoolSize: 0/);
  assert.match(dbSource, /maxPoolSize: 4/);
  assert.match(dbSource, /maxConnecting: 2/);
  assert.match(dbSource, /maxIdleTimeMS: 30_000/);
  assert.match(dbSource, /waitQueueTimeoutMS: 15_000/);
  assert.doesNotMatch(dbSource, /new MongoClient\([^\n]+\)\.connect\(\)/);
});

test("release status and pilot evidence point to the same published version", () => {
  const releaseVersion = releaseStatus.match(/Versão do Worker: `([^`]+)`/)?.[1];
  const evidenceVersion = e2eEvidence.match(/versão `([^`]+)` publicada/)?.[1];
  assert.ok(releaseVersion);
  assert.ok(evidenceVersion);
  assert.match(e2eEvidence, new RegExp(releaseVersion.replaceAll("-", "\\-")));
  assert.notEqual(releaseVersion, evidenceVersion, "staging E2E must not be presented as a production release");
  assert.match(releaseStatus, /Última publicação autorizada: ciclo \d+/);
  assert.match(releaseStatus, /Próximo marco de publicação: próximo lote de três ciclos/);
});

test("incident evidence names the current published version", () => {
  const releaseVersion = releaseStatus.match(/Versão do Worker: `([^`]+)`/)?.[1];
  assert.ok(releaseVersion);
  assert.match(incidentDoc, new RegExp(releaseVersion.replaceAll("-", "\\-")));
  assert.match(incidentDoc, /Suítes locais revalidadas nesta auditoria: frontend com 308 testes/);
  assert.match(incidentDoc, /Worker com 80 testes/);
});

test("pilot evidence records authenticated E2E without exposing secrets", () => {
  assert.match(e2eEvidence, /Resultado geral histórico: `aprovado`/);
  assert.match(e2eEvidence, /E2E-2026-11-21-STAGING-01/);
  assert.match(e2eEvidence, /Nenhuma etapa abaixo é considerada concluída apenas por existir no código/);
  assert.match(e2eEvidence, /não anexar exportações de banco, senhas, tokens/);
});

test("Mongo restore remains explicitly gated", () => {
  assert.match(restoreScript, /Set-StrictMode -Version Latest/);
  assert.match(restoreScript, /\[switch\]\$ConfirmDrop/);
  assert.match(restoreScript, /if \(-not \$ConfirmDrop\)/);
  assert.match(restoreScript, /Test-Path -LiteralPath \$Archive -PathType Leaf/);
  assert.match(restoreScript, /TargetDatabase -ieq \$Database/);
  assert.match(restoreScript, /--nsInclude "\$\{Database\}\.\*" --nsFrom "\$\{Database\}\.\*" --nsTo "\$\{TargetDatabase\}\.\*"/);
  assert.match(restoreScript, /\$LASTEXITCODE -ne 0/);
  assert.match(operationsDoc, /banco separado/);
  assert.match(operationsDoc, /nunca restaur[e|a] diretamente em produção/i);
});

test("migration scripts do not print database connection secrets", () => {
  assert.doesNotMatch(migration, /console\.log\([\s\S]{0,200}(?:MONGODB_URI|mongodb(?:\+srv)?:\/\/)/i);
  assert.doesNotMatch(repairMigration, /console\.log\([\s\S]{0,200}(?:MONGODB_URI|mongodb(?:\+srv)?:\/\/)/i);
});

test("Mongo backup fails closed instead of overwriting an archive", () => {
  assert.match(backupScript, /Set-StrictMode -Version Latest/);
  assert.match(backupScript, /Resolve-Path -LiteralPath \$OutputDirectory/);
  assert.match(backupScript, /Test-Path -LiteralPath \$archive/);
  assert.match(backupScript, /já existe/);
});

test("Mongo backup workflow restricts runner dump permissions", () => {
  assert.match(backupWorkflow, /set -euo pipefail/);
  assert.match(backupWorkflow, /umask 077/);
});

test("Mongo backup workflow serializes runs without cancelling a backup", () => {
  assert.match(backupWorkflow, /concurrency:/);
  assert.match(backupWorkflow, /group: mongodb-backup/);
  assert.match(backupWorkflow, /cancel-in-progress: false/);
});

test("role guard denies valid sessions with the wrong role", () => {
  assert.match(coreSource, /if \(!roles\.includes\(user\.role as Role\)\) return fail\("Perfil sem permissão para esta operação", 403\)/);
});

test("profile lookup remains bound to the authenticated account", () => {
  assert.match(coreSource, /findOne\(collection, \{ user_id: user\.id \}\)/);
  assert.match(coreSource, /const collection = user\.role === "student" \? "students" : "professionals"/);
});

test("capacity lookups remain scoped to the current professional", () => {
  assert.match(dbSource, /collection<RecordDoc>\("availability"\)\.find\(\{ professional_id: professionalId/);
  assert.match(dbSource, /withCapacityLock\(professionalId/);
  assert.match(routesSource, /professional_id: professional\.id/);
});

test("published availability preserves the professional institution scope", () => {
  assert.match(routesSource, /professional_id: professional\.id, institution_id: professional\.institution_id/);
  assert.match(routesSource, /professional\.link_type !== "institution"/);
  assert.match(routesSource, /refreshStudentPanels\(env, store, professional\.institution_id\)/);
});

test("reserved availability cannot be deleted by the professional", () => {
  assert.match(dbSource, /deleteAvailability\(slotId: string, professionalId: string\)/);
  assert.match(dbSource, /professional_id: professionalId, status: "open"/);
  assert.match(routesSource, /Horário reservado por um estudante/);
});

test("direct confirmation keeps institution and professional scope", () => {
  assert.match(routesSource, /professional\.institution_id/);
  assert.match(dbSource, /confirmDirectAppointment/);
  assert.match(dbSource, /withCapacityLock\(professionalId/);
});

test("notification fan-out remains deduplicated", () => {
  assert.match(routesSource, /notifyUser/);
  assert.match(routesSource, /dedupe_key/);
});

test("worker error logs keep exception details out of responses", () => {
  assert.match(observabilitySource, /export function logOperational\(event: string/);
  assert.match(observabilitySource, /sanitizeOperationalFields\(fields\)/);
  assert.match(operationsSource, /SENSITIVE_KEY/);
  assert.match(workerIndex, /logOperational\("api_unhandled_error", \{ method: request\.method, route: url\.pathname, error_name:/);
  assert.match(workerIndex, /logOperational\("realtime_upgrade_failed", \{ method: request\.method, route: url\.pathname, error_name:/);
  assert.match(workerIndex, /Erro interno do serviço/);
  assert.match(coreSource, /logOperational\("realtime_broadcast_failed"/);
});

test("session closure requires the correct current status", () => {
  assert.match(routesSource, /Conversa já encerrada/);
  assert.match(routesSource, /sessionHasStarted\(session\)/);
  assert.match(routesSource, /closeSession\(completeId, professional\.id, "completed"\)/);
});

test("absence registration also respects the scheduled start", () => {
  assert.match(routesSource, /A ausência só pode ser registrada depois do horário marcado/);
  assert.match(routesSource, /closeSession\(noShowId, professional\.id, "no_show"\)/);
});

test("session closure notifies the student and refreshes panels", () => {
  assert.match(routesSource, /session_completed/);
  assert.match(routesSource, /session_no_show/);
  assert.match(routesSource, /refreshStudentPanels\(env, store, professional\.institution_id\)/);
});

test("feedback is limited to completed sessions and bounded fields", () => {
  assert.match(routesSource, /Feedback disponível após a conversa/);
  assert.match(routesSource, /score < 1 \|\| score > 5/);
  assert.match(routesSource, /string\(payload\.comment\)\.length > 400/);
});

test("local smoke test validates only public health fields", () => {
  assert.match(smokeScript, /payload\.ok -ne \$true -or \$payload\.service -ne "acolhe" -or \$payload\.database -ne "ok"/);
  assert.match(smokeScript, /payload\.service -ne "acolhe"/);
  assert.match(smokeScript, /allowedHealthFields/);
  assert.match(smokeScript, /unexpectedHealthFields/);
  assert.match(smokeScript, /checked_at/);
  assert.match(smokeScript, /TryParse/);
  assert.match(smokeScript, /Content-Type.*application\/json/);
  assert.match(smokeScript, /robots\.txt/);
  assert.match(smokeScript, /sitemap\.xml/);
  assert.match(smokeScript, /points to another origin/);
  assert.match(smokeScript, /politica-de-cookies/);
  assert.match(smokeScript, /ajuda\/instituicoes/);
  assert.match(smokeScript, /robots\.txt must be text\/plain/);
  assert.match(smokeScript, /sitemap\.xml must be XML/);
  assert.match(smokeScript, /Write-Output "Smoke test passed/);
  assert.doesNotMatch(smokeScript, /Write-Output \$health\.Content/);
  assert.match(operationsDoc, /falha na primeira resposta inválida/);
  assert.match(operationsDoc, /schema mínimo do healthcheck/);
  assert.match(operationsDoc, /robots\.txt.*text\/plain/);
  assert.match(operationsDoc, /sitemap\.xml.*XML/);
  assert.match(operationsDoc, /uptime\.yml.*robots\.txt.*sitemap\.xml/s);
  assert.match(operationsDoc, /apontamento de `robots\.txt`.*conteúdo mínimo de `sitemap\.xml`/s);
});
