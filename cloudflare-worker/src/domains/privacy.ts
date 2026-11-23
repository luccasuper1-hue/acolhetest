/** Shared privacy constants and pure helpers. Keep this module free of I/O. */
export const CONSENT_VERSION = "pilot-v1" as const;
export const PRODUCT_TIME_ZONE = "America/Fortaleza" as const;
export const CHILD_AGE_LIMIT = 12 as const;
export const MINIMUM_AGGREGATE_SAMPLE = 5 as const;

export type AgeBand = "child" | "adolescent" | "adult";

export function ageBandFor(age: number): AgeBand {
  if (!Number.isFinite(age) || age < 0) throw new RangeError("age must be a non-negative number");
  return age < CHILD_AGE_LIMIT ? "child" : age < 18 ? "adolescent" : "adult";
}

/** Administrative exports must never include conversation content or credentials. */
export function safeAdministrativeUser(user: Record<string, unknown>) {
  return {
    id: typeof user.id === "string" ? user.id : null,
    name: typeof user.name === "string" ? user.name : null,
    role: typeof user.role === "string" ? user.role : null,
    institution_id: typeof user.institution_id === "string" ? user.institution_id : null,
    active: user.active !== false,
    age_band: typeof user.age_band === "string" ? user.age_band : null,
    consent_version: typeof user.consent_version === "string" ? user.consent_version : null,
    consent_accepted_at: typeof user.consent_accepted_at === "string" ? user.consent_accepted_at : null,
  };
}

export function suppressSmallSample(sampleSize: number, value: number | null): number | null {
  return Number.isFinite(sampleSize) && sampleSize >= MINIMUM_AGGREGATE_SAMPLE ? value : null;
}
