/**
 * Communication Health — “needs your attention” tile ↔ Message History filter.
 * Eligibility matches dashboard-counts (failed / undelivered only).
 */
import { isDeliveryFailureStatus } from "@/lib/communication/status-labels";

/** Statuses counted by the attention tile and shown in the attention filter. */
export const NEEDS_ATTENTION_STATUSES = ["failed", "undelivered"] as const;

export type NeedsAttentionStatus = (typeof NEEDS_ATTENTION_STATUSES)[number];

export function isNeedsAttentionStatus(
  status: string | null | undefined,
): status is NeedsAttentionStatus {
  return isDeliveryFailureStatus(status);
}

/** Interactive destination for the attention tile — null when count is 0. */
export function attentionHistoryHref(needsAttentionCount: number): string | null {
  if (needsAttentionCount <= 0) return null;
  return "/messaging/health?attention=1";
}

export function isAttentionHistoryFilterActive(
  attentionParam: string | null | undefined,
): boolean {
  return attentionParam === "1" || attentionParam === "true";
}

export function attentionTileAriaLabel(needsAttentionCount: number): string {
  if (needsAttentionCount <= 0) {
    return "No messages need your attention";
  }
  const noun = needsAttentionCount === 1 ? "message" : "messages";
  return `${needsAttentionCount} ${noun} need your attention. View delivery failures.`;
}

/**
 * Paginate an already-sorted attention list (newest first).
 * page is 1-based; returns the slice and whether more remain.
 */
export function pageAttentionItems<T>(
  items: readonly T[],
  pageSize: number,
  page: number,
): { pageItems: T[]; hasMore: boolean; total: number } {
  const size = Math.max(1, Math.trunc(pageSize));
  const p = Math.max(1, Math.trunc(page));
  const start = (p - 1) * size;
  const pageItems = items.slice(start, start + size);
  return {
    pageItems,
    hasMore: start + pageItems.length < items.length,
    total: items.length,
  };
}

/** Count must equal distinct qualifying rows (no double-count within one source list). */
export function countNeedsAttentionStatuses(
  statuses: Array<string | null | undefined>,
): number {
  return statuses.filter((s) => isNeedsAttentionStatus(s)).length;
}
