/**
 * Inbox header unread total — race-safe adjustments when a conversation's
 * venueUnread is cleared after a successful open (or equivalent UI sync).
 *
 * Subtract only the prior per-conversation unread count once. A second clear
 * with venueUnread already 0 subtracts nothing.
 */

/** New header total after clearing `priorVenueUnread` on one conversation. */
export function totalUnreadAfterConversationCleared(
  totalUnread: number,
  priorVenueUnread: number,
): number {
  const cleared = Math.max(0, Math.floor(Number(priorVenueUnread) || 0));
  if (cleared <= 0) return Math.max(0, totalUnread);
  return Math.max(0, totalUnread - cleared);
}
