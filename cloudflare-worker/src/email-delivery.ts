export type EmailDeliveryDecision = {
  status: "sent" | "pending" | "failed";
  next_attempt_at?: string;
  failure?: "provider_unavailable" | "missing_recipient_email" | "retry_limit_reached";
};

export function resolveEmailDelivery(attempts: number, delivered: boolean, hasRecipient: boolean, nowMs = Date.now()): EmailDeliveryDecision {
  if (delivered) return { status: "sent" };
  if (!hasRecipient) return { status: "failed", failure: "missing_recipient_email" };
  if (attempts >= 5) return { status: "failed", failure: "retry_limit_reached" };
  const delayMinutes = Math.min(60, 2 ** Math.min(Math.max(attempts, 1), 6));
  return { status: "pending", next_attempt_at: new Date(nowMs + delayMinutes * 60_000).toISOString(), failure: "provider_unavailable" };
}
