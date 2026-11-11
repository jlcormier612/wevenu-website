/**
 * Aggregation for Communication Health dashboard tiles.
 * Kept pure so tests can prove Sent vs Delivered vs needs-attention filters.
 */
import { countNeedsAttentionStatuses } from "@/lib/communication/attention-history";

/** Delivered-successfully includes later engagement / reply states. */
export const DELIVERED_LIKE_STATUSES = new Set([
  "delivered",
  "opened",
  "clicked",
  "replied",
]);

export type OutboundCountBreakdown = {
  sent: number;
  delivered: number;
  needsAttention: number;
};

export function aggregateOutboundStatusCounts(
  statuses: Array<string | null | undefined>,
): OutboundCountBreakdown {
  return {
    sent: statuses.length,
    delivered: statuses.filter((s) => s != null && DELIVERED_LIKE_STATUSES.has(s)).length,
    needsAttention: countNeedsAttentionStatuses(statuses),
  };
}
