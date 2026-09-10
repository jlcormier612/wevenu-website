/**
 * Relationship SMS / customer-channel conversation resolution.
 *
 * After Vendor Network, multiple conversation kinds can share relationship_id
 * (venue_couple + couple_vendor_inquiry). SMS and other relationship-channel
 * paths must always use venue_couple — never an inquiry thread.
 */

export const VENUE_COUPLE_CONVERSATION_KIND = "venue_couple" as const;

type IdRow = { id: string };

/** Minimal client surface used by find/create (Supabase or admin). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/**
 * Locate the venue↔couple conversation for a relationship.
 * Never returns couple_vendor_inquiry (or other kinds).
 */
export async function findVenueCoupleConversationId(
  client: AnyDb,
  relationshipId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("conversations")
    .select("id")
    .eq("relationship_id", relationshipId)
    .eq("conversation_kind", VENUE_COUPLE_CONVERSATION_KIND)
    .maybeSingle();
  if (error) throw error;
  return (data as IdRow | null)?.id ?? null;
}

/**
 * Find or create the venue_couple conversation for SMS / scheduled / external
 * relationship messaging. Inserts always set conversation_kind explicitly.
 */
export async function findOrCreateVenueCoupleConversation(
  client: AnyDb,
  venueId: string,
  relationshipId: string,
): Promise<string | null> {
  const existing = await findVenueCoupleConversationId(client, relationshipId);
  if (existing) return existing;

  const { data: created, error } = await client
    .from("conversations")
    .insert({
      venue_id: venueId,
      relationship_id: relationshipId,
      conversation_kind: VENUE_COUPLE_CONVERSATION_KIND,
    })
    .select("id")
    .single();

  if (error || !(created as IdRow | null)?.id) return null;
  return (created as IdRow).id;
}
