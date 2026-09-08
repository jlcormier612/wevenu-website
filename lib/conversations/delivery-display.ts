/**
 * Pure helpers for rendering outbound delivery state in Inbox.
 * Used by UI and tests — no provider jargon, no invented Read for SMS.
 */
import {
  MESSAGE_STATUS_META,
  channelSupportsReadState,
  isDeliveryFailureStatus,
} from "@/lib/communication/status-labels";

export type DeliveryDisplay = {
  status: string;
  label: string;
  emoji: string;
  isFailure: boolean;
  /** Human-readable reason when available — never raw provider codes by default. */
  reason: string | null;
  /** Whether opened/clicked/read may be shown for this channel+status. */
  showAsReadLike: boolean;
};

/**
 * Map a stored message status + channel into venue-facing delivery display.
 * Returns null when no outbound delivery badge should show.
 */
export function resolveDeliveryDisplay(input: {
  status: string | null | undefined;
  channel: string | null | undefined;
  failureReason?: string | null;
  isOutbound: boolean;
}): DeliveryDisplay | null {
  if (!input.isOutbound || !input.status) return null;
  const meta = MESSAGE_STATUS_META[input.status];
  if (!meta) return null;

  // Never invent Read for channels that don't provide it (SMS).
  if (
    (input.status === "opened" || input.status === "clicked")
    && !channelSupportsReadState(input.channel)
  ) {
    return null;
  }

  const isFailure = isDeliveryFailureStatus(input.status);
  return {
    status: input.status,
    label: meta.label,
    emoji: meta.emoji,
    isFailure,
    reason: isFailure ? (input.failureReason?.trim() || null) : null,
    showAsReadLike:
      channelSupportsReadState(input.channel)
      && (input.status === "opened" || input.status === "clicked"),
  };
}

/** Guard: failed/undelivered must never present as successfully delivered. */
export function claimsSuccessfulDelivery(status: string | null | undefined): boolean {
  return status === "delivered" || status === "opened" || status === "clicked" || status === "replied";
}

export function deliveryDisplayIsHonest(status: string | null | undefined): boolean {
  if (isDeliveryFailureStatus(status)) {
    return !claimsSuccessfulDelivery(status);
  }
  return true;
}
