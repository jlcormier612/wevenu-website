/**
 * Pure redundancy gates for Luv sales/tour follow-up drafts.
 * Prevents duplicate pending review drafts and near-duplicate recent outbound.
 */

export const FOLLOW_UP_REDUNDANT_OUTBOUND_WINDOW_MS = 48 * 60 * 60 * 1000;

export type FollowUpRedundancyDecision = {
  block: boolean;
  reason: string | null;
  code: "pending_equivalent" | "recent_outbound" | null;
};

/**
 * Block generating another follow_up_email when an actionable pending draft
 * already exists, or when the venue already sent outbound recently.
 */
export function resolveFollowUpDraftRedundancy(input: {
  actionablePendingFollowUpCount: number;
  recentVenueOutboundAt?: string | null;
  nowMs?: number;
  recentWindowMs?: number;
}): FollowUpRedundancyDecision {
  if (input.actionablePendingFollowUpCount > 0) {
    return {
      block: true,
      code: "pending_equivalent",
      reason:
        "There’s already a follow-up draft waiting for review — open that one instead of creating another.",
    };
  }

  const outboundAt = input.recentVenueOutboundAt ?? null;
  if (outboundAt) {
    const sentMs = Date.parse(outboundAt);
    const nowMs = input.nowMs ?? Date.now();
    const windowMs = input.recentWindowMs ?? FOLLOW_UP_REDUNDANT_OUTBOUND_WINDOW_MS;
    if (Number.isFinite(sentMs) && nowMs - sentMs < windowMs && nowMs >= sentMs) {
      return {
        block: true,
        code: "recent_outbound",
        reason:
          "You already reached out recently — give them a little time before drafting another follow-up.",
      };
    }
  }

  return { block: false, code: null, reason: null };
}

/** Latest venue/staff outbound timestamp from thread messages (ISO). */
export function latestVenueOutboundAt(
  messages: { sentAt: string; senderType: string }[],
): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const m of messages) {
    const st = (m.senderType ?? "").toLowerCase();
    if (st !== "venue" && st !== "staff" && st !== "coordinator") continue;
    const ms = Date.parse(m.sentAt);
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = m.sentAt;
    }
  }
  return best;
}
