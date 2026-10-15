/**
 * Decision C — distinct lead-level message-attention indicator.
 *
 * Based on conversations.needs_response for the lead's venue_couple thread —
 * not on leads.venue_seen_at (unseen-new-lead) and not on venue_unread
 * (Inbox badge). Opening a conversation clears unread only; needs_response
 * clears via reply or explicit clear RPC.
 */

export type LeadMessageAttention = {
  conversationId: string;
  /** Deep link into the lead Conversation tab. */
  href: string;
};

export function leadShowsMessageAttention(attention: LeadMessageAttention | null | undefined): boolean {
  return Boolean(attention?.conversationId);
}

export function leadMessageAttentionHref(leadId: string, conversationId: string): string {
  return `/leads/${leadId}?conversation=${conversationId}#messages`;
}

export function pickLeadMessageAttention(rows: Array<{
  leadId: string;
  conversationId: string;
  needsResponse: boolean;
  lastMessageAt: string | null;
}>): Map<string, LeadMessageAttention> {
  const byLead = new Map<string, { conversationId: string; lastMessageAt: string | null }>();
  for (const row of rows) {
    if (!row.needsResponse) continue;
    const prev = byLead.get(row.leadId);
    if (!prev) {
      byLead.set(row.leadId, {
        conversationId: row.conversationId,
        lastMessageAt: row.lastMessageAt,
      });
      continue;
    }
    const prevTs = prev.lastMessageAt ? Date.parse(prev.lastMessageAt) : 0;
    const nextTs = row.lastMessageAt ? Date.parse(row.lastMessageAt) : 0;
    if (nextTs >= prevTs) {
      byLead.set(row.leadId, {
        conversationId: row.conversationId,
        lastMessageAt: row.lastMessageAt,
      });
    }
  }
  const out = new Map<string, LeadMessageAttention>();
  for (const [leadId, picked] of byLead) {
    out.set(leadId, {
      conversationId: picked.conversationId,
      href: leadMessageAttentionHref(leadId, picked.conversationId),
    });
  }
  return out;
}

type QueryClient = {
  from: (table: string) => any;
};

/**
 * Batch-load message attention for lead list rows (needs_response conversations).
 */
export async function loadLeadMessageAttentionMap(
  client: QueryClient,
  leads: Array<{ id: string; relationshipId: string | null; venueId?: string | null }>,
): Promise<Map<string, LeadMessageAttention>> {
  const withRel = leads.filter((l) => l.relationshipId);
  if (withRel.length === 0) return new Map();

  const relationshipIds = [...new Set(withRel.map((l) => l.relationshipId!))];
  const { data: convos, error } = await client
    .from("conversations")
    .select("id, relationship_id, needs_response, last_message_at")
    .in("relationship_id", relationshipIds)
    .eq("needs_response", true);

  if (error || !convos?.length) return new Map();

  const leadByRel = new Map<string, string[]>();
  for (const lead of withRel) {
    const list = leadByRel.get(lead.relationshipId!) ?? [];
    list.push(lead.id);
    leadByRel.set(lead.relationshipId!, list);
  }

  const flat: Array<{
    leadId: string;
    conversationId: string;
    needsResponse: boolean;
    lastMessageAt: string | null;
  }> = [];

  for (const c of convos as Array<{
    id: string;
    relationship_id: string;
    needs_response: boolean;
    last_message_at: string | null;
  }>) {
    const leadIds = leadByRel.get(c.relationship_id) ?? [];
    for (const leadId of leadIds) {
      flat.push({
        leadId,
        conversationId: c.id,
        needsResponse: Boolean(c.needs_response),
        lastMessageAt: c.last_message_at,
      });
    }
  }

  return pickLeadMessageAttention(flat);
}
