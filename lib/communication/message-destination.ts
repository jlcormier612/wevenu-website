/**
 * Destination for a Communication Health history / issue row.
 *
 * Prefer the relationship record (client, then lead) when present so the
 * coordinator lands on the Conversation tab. When the conversation exists
 * but no lead/client row is linked (orphan test relationships, deleted
 * records, incomplete inbox_owner), fall back to Inbox deep-link
 * `/messaging?conversation=` — already supported by ConversationInbox.
 */
export function messageDestinationHref(opts: {
  clientId?: string | null;
  leadId?: string | null;
  conversationId?: string | null;
}): string | null {
  if (opts.clientId) return `/clients/${opts.clientId}`;
  if (opts.leadId) return `/leads/${opts.leadId}`;
  if (opts.conversationId) return `/messaging?conversation=${opts.conversationId}`;
  return null;
}
