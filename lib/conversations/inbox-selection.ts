/**
 * Inbox selection rules — bucket switches must not keep a foreign thread.
 */

import type { InboxCategory } from "@/lib/navigation/attention";

/**
 * When the inbox category (Leads / Clients / Vendors / …) changes, drop the
 * prior selection immediately. Same-bucket re-clicks keep the selection.
 * A conversation that also belongs in the destination bucket is re-selected
 * only by an explicit click after the new list loads — never by leftover state.
 */
export function selectionAfterInboxCategoryChange(
  previousCategory: InboxCategory,
  nextCategory: InboxCategory,
  activeConversationId: string | null,
): string | null {
  if (previousCategory === nextCategory) return activeConversationId;
  return null;
}

/**
 * After a list page replaces for the current bucket, drop a selection that is
 * not in that page. While the list is still loading, keep the selection so a
 * deep link is not cleared before its category list arrives.
 *
 * When `deepLinkConversationId` matches the active id, keep it even if this
 * page does not yet include it — category resolution may still be in flight.
 */
export function selectionAfterInboxListReplace(opts: {
  loading: boolean;
  conversationIds: readonly string[];
  activeConversationId: string | null;
  deepLinkConversationId?: string | null;
}): string | null {
  const active = opts.activeConversationId;
  if (!active) return null;
  if (opts.loading) return active;
  if (opts.deepLinkConversationId && opts.deepLinkConversationId === active) return active;
  if (opts.conversationIds.includes(active)) return active;
  return null;
}
