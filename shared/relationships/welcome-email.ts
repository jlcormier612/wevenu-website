/**
 * Per checkout-session welcome send. The durable marker is set only after
 * the transport reports delivery "sent". A claim covers the crash window
 * between send and the marker write.
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
