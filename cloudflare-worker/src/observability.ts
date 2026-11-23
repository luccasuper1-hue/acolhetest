import { sanitizeOperationalFields, type OperationalField } from "./domains/operations";

const operationalNow = () => new Date().toISOString();

export type { OperationalField } from "./domains/operations";

/** Emit only bounded operational fields; never pass request payloads or identifiers here. */
export function logOperational(event: string, fields: Record<string, OperationalField> = {}) {
  console.error(JSON.stringify({ event: event.slice(0, 80), ...sanitizeOperationalFields(fields), at: operationalNow() }));
}
