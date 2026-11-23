import { performance } from "node:perf_hooks";

const base = (process.env.BASE_URL || "https://acolhetest-staging.luccasuper1.workers.dev").replace(/\/$/, "");
const password = process.env.LOAD_PASSWORD;
const prefix = process.env.LOAD_PREFIX;
if (!prefix || !password) throw new Error("Defina LOAD_PREFIX e LOAD_PASSWORD para as contas temporárias do staging.");
const studentCount = Number(process.env.STUDENT_USERS || 30);
if (!Number.isInteger(studentCount) || studentCount < 1 || studentCount > 500) throw new Error("STUDENT_USERS deve ser um inteiro entre 1 e 500.");
const REQUEST_TIMEOUT_MS = 15_000;
const LOGIN_DELAY_MS = Number(process.env.LOGIN_DELAY_MS || 250);

const fetchWithTimeout = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

function accounts() {
  const students = Array.from({ length: studentCount }, (_, i) => ({ role: "student", email: `${prefix}-student-${i}@example.test`, endpoint: "/api/students/me/dashboard" }));
  return [...students,
    { role: "professional", email: `${prefix}-professional@example.test`, endpoint: "/api/professionals/me/dashboard" },
    { role: "institution", email: `${prefix}-institution@example.test`, endpoint: "/api/institutions/me/dashboard" },
    { role: "admin", email: `${prefix}-admin@example.test`, endpoint: "/api/admin/dashboard" },
  ];
}

async function login(account) {
  const response = await fetchWithTimeout(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: account.email, password }) });
  const cookies = response.headers.getSetCookie?.() || [];
  if (!response.ok || !cookies.length) throw new Error(`login ${account.role} ${response.status}`);
  return { ...account, cookie: cookies.map((value) => value.split(";", 1)[0]).join("; ") };
}

async function read(account) {
  const started = performance.now();
  try {
    const response = await fetchWithTimeout(`${base}${account.endpoint}`, { headers: { cookie: account.cookie }, cache: "no-store" });
    const elapsed = performance.now() - started;
    return { role: account.role, status: response.status, ms: elapsed, login_error: account.login_error || null };
  } catch (error) {
    return { role: account.role, status: 0, ms: performance.now() - started, error: error instanceof Error ? error.name : "unknown", login_error: account.login_error || null };
  }
}

// Pace authentication so the harness does not turn its own login burst into
// a rate-limit benchmark; panel reads remain concurrent below.
const logged = [];
for (const account of accounts()) {
  try { logged.push(await login(account)); }
  catch (error) { logged.push({ ...account, cookie: "", login_error: error instanceof Error ? error.name : "unknown" }); }
  if (LOGIN_DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, LOGIN_DELAY_MS));
}
const rounds = Number(process.env.LOAD_ROUNDS || 10);
const all = [];
const started = performance.now();
for (let round = 0; round < rounds; round += 1) all.push(...await Promise.all(logged.map(read)));
const elapsed = performance.now() - started;

const percentile = (values, p) => values[Math.min(values.length - 1, Math.floor(values.length * p))] || 0;
const summary = {};
for (const role of ["student", "professional", "institution", "admin"]) {
  const rows = all.filter((row) => row.role === role).sort((a, b) => a.ms - b.ms);
  summary[role] = { requests: rows.length, login_errors: rows.filter((row) => row.login_error).length, success: rows.filter((row) => row.status === 200 && !row.login_error).length, errors: rows.filter((row) => row.status !== 200 || row.login_error).length, avg_ms: Math.round(rows.reduce((sum, row) => sum + row.ms, 0) / Math.max(1, rows.length)), p95_ms: Math.round(percentile(rows.map((row) => row.ms), 0.95)), max_ms: Math.round(rows.at(-1)?.ms || 0) };
}
console.log(JSON.stringify({ base, users: logged.length, rounds, total_requests: all.length, wall_ms: Math.round(elapsed), summary }, null, 2));
