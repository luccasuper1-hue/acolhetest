/** Operational logging policy. This module deliberately has no request/database imports. */
const SENSITIVE_KEY = /(?:token|secret|password|cookie|authorization|credential|email|phone|message|body|content|ip|user_id|student_id|professional_id|institution_id|session_id|request_id)/i;

const ROUTE_RESOURCES: Record<string, ReadonlySet<string>> = {
  auth: new Set(["register", "login", "logout", "me", "account", "change-password", "invite", "forgot-password", "reset-password"]),
  students: new Set(["dashboard", "notifications", "professionals", "requests", "appointment-requests", "availability-interest", "sessions"]),
  professionals: new Set(["dashboard", "notifications", "certificate", "availability", "requests", "appointment-requests", "sessions"]),
  institutions: new Set(["dashboard", "notifications", "professionals", "minor-registrations", "metrics", "impact-report", "fallback-requests"]),
  admin: new Set(["dashboard", "notifications", "leads", "users", "institutions", "requests", "certificates", "audit"]),
};

/** Keep useful route groups in logs without ever including caller-supplied IDs or tokens. */
export function operationalRoute(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") return "other";
  if (parts.length === 1) return "/api";
  if (["live", "ready", "health", "realtime", "analytics"].includes(parts[1])) return `/api/${parts[1]}`;
  if (parts[1] === "certificates") return "/api/certificates/:code";
  if (parts[1] === "metrics" && parts[2] === "global") return "/api/metrics/global";
  if (parts[1] === "leads" && ["institution", "professional"].includes(parts[2])) return `/api/leads/${parts[2]}`;
  const resources = ROUTE_RESOURCES[parts[1]];
  if (!resources) return "/api/other";
  const scoped = ["students", "professionals", "institutions"].includes(parts[1]);
  if (scoped && parts[2] !== "me") return `/api/${parts[1]}/other`;
  const resource = parts[scoped ? 3 : 2];
  return resource && resources.has(resource)
    ? `/api/${parts[1]}${scoped ? "/me" : ""}/${resource}`
    : `/api/${parts[1]}/other`;
}

export type OperationalField = string | number | boolean | null;

export function sanitizeOperationalFields(fields: Record<string, OperationalField>): Record<string, OperationalField> {
  const safe: Record<string, OperationalField> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (key === "route" && typeof value === "string") safe[key] = operationalRoute(value);
    else if (typeof value === "string") safe[key] = value.slice(0, 160);
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "boolean" || value === null) safe[key] = value;
  }
  return safe;
}
