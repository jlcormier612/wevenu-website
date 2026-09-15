/** Unread venue messages for the couple portal nav badge. */
export function countUnreadVenueMessages(
  messages: Array<{ sender_type?: string; couple_read_at?: string | null }>,
): number {
  return messages.filter((m) => m.sender_type === "venue" && !m.couple_read_at).length;
}
