/**
 * Resolve venue↔couple conversation id for couple-facing outbound email
 * threading (sendEmail threadId). Same find-or-create path as proposals,
 * contracts, and recordExternalClientOutbound.
 */
import { findOrCreateVenueCoupleConversation } from "@/lib/conversations/venue-couple-conversation";

type AdminLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export async function resolveVenueCoupleThreadId(
  supabase: AdminLike,
  venueId: string,
  opts: {
    relationshipId?: string | null;
    clientId?: string | null;
    leadId?: string | null;
  },
): Promise<string | null> {
  let relationshipId = opts.relationshipId ?? null;

  if (!relationshipId && opts.clientId) {
    const { data } = await supabase
      .from("clients")
      .select("relationship_id")
      .eq("id", opts.clientId)
      .maybeSingle();
    relationshipId = (data?.relationship_id as string | null) ?? null;
  }

  if (!relationshipId && opts.leadId) {
    const { data } = await supabase
      .from("leads")
      .select("relationship_id")
      .eq("id", opts.leadId)
      .maybeSingle();
    relationshipId = (data?.relationship_id as string | null) ?? null;
  }

  if (!relationshipId) return null;
  return findOrCreateVenueCoupleConversation(supabase, venueId, relationshipId);
}
