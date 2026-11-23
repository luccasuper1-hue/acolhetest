const CONSENT_KEY = "acolhe-cookie-consent-v1";
const VISITOR_KEY = "acolhe-analytics-visitor-v1";

function hasMeasurementConsent() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(CONSENT_KEY) || "null");
    return saved?.version === "v1" && saved?.preferences?.measurement === true;
  } catch { return false; }
}

function visitorId() {
  try {
    let value = window.localStorage.getItem(VISITOR_KEY);
    if (!value) { value = crypto.randomUUID().replaceAll("-", ""); window.localStorage.setItem(VISITOR_KEY, value); }
    return value;
  } catch { return ""; }
}

export function trackAnalytics(page = "/") {
  if (typeof window === "undefined" || !hasMeasurementConsent()) return;
  const privatePrefixes = ["/admin", "/aluno", "/profissional", "/instituicao", "/convite", "/entrar", "/login", "/recuperar-senha", "/redefinir-senha"];
  const normalizedPage = String(page || "/").slice(0, 120);
  if (privatePrefixes.some(prefix => normalizedPage === prefix || normalizedPage.startsWith(`${prefix}/`))) return;
  const visitor_id = visitorId();
  if (!visitor_id) return;
  fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitor_id, page: normalizedPage, consent_version: "v1", measurement_consent: true }), keepalive: true }).catch(() => {});
}

export function listenForAnalyticsConsent(onConsent) {
  if (typeof window === "undefined") return () => {};
  const handler = event => { if (event.detail?.preferences?.measurement === true) onConsent?.(); };
  window.addEventListener("acolhe:cookie-consent", handler);
  return () => window.removeEventListener("acolhe:cookie-consent", handler);
}
