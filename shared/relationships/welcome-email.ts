/**
 * Per checkout-session welcome send.
 *
 * Guarantee:
 * - no send before the product enrollment exists;
 * - failed/simulated delivery does not set welcome_email_sent_at;
 * - a stored sent marker skips replay;
 * - an in-flight claim skips a second sender for 10 minutes;
 * - Resend Idempotency-Key `htc-welcome:{session}:{template}` is sent when the
 *   transport is live (Resend returns the original email for 24 hours).
 *
 * Remaining edge: if Resend accepts the send, the process crashes before the
 * marker write, and the claim expires after 10 minutes, we retry. The
 * Idempotency-Key should prevent a second delivery inside Resend's 24h window.
 * After 24 hours that provider key expires, so a later retry could send again.
 * That is at-least-once across that crash+expiry window, not at-most-once.
 */

const WELCOME_CLAIM_TTL_MS = 10 * 60 * 1000;
const WELCOME_TEMPLATE_IDS = new Set(["welcome", "founder_welcome", "white_glove_welcome"]);

export function resolveWelcomeEmailAttempt(input: {
  sentAt: string | null | undefined;
  claimedAt: string | null | undefined;
  now: number;
  claimTtlMs?: number;
}): "skip_sent" | "skip_in_flight" | "send" {
  if (input.sentAt) return "skip_sent";
  const ttl = input.claimTtlMs ?? WELCOME_CLAIM_TTL_MS;
  if (input.claimedAt) {
    const claimed = Date.parse(input.claimedAt);
    if (Number.isFinite(claimed) && input.now - claimed < ttl) return "skip_in_flight";
  }
  return "send";
}

export function welcomeBatchSucceeded(
  results: Array<{ templateId?: string | null; ok: boolean; delivery: string }>,
): boolean {
  const welcome = results.find(
    (r) => r.templateId && WELCOME_TEMPLATE_IDS.has(r.templateId),
  );
  return Boolean(welcome && welcome.ok && welcome.delivery === "sent");
}
