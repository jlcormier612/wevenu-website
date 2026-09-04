/**
 * Record an externally delivered client communication into the relationship
 * conversation (conversation_messages) — the single communication history.
 *
 * Used by obligation reminders, task/tour couple reminders, contract invites,
 * and any other automated external send that must not live only in
 * notification_log. Manual compose and scheduled sends already record via
 * their own paths; this helper is the smallest shared write for engines that
 * previously audited only.
 *
 * Does NOT insert internal-only venue staff notifications.
 */
type AdminLike = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type ExternalOutboundChannel = "email" | "sms" | "portal";

export type RecordExternalOutboundInput = {
  venueId: string;
  channel: ExternalOutboundChannel;
  body: string;
  /** Prefer when known. */
  relationshipId?: string | null;
  clientId?: string | null;
  leadId?: string | null;
  providerId?: string | null;
  status?: string | null;
  /** Audit linkage retained alongside notification_log. */
  sourceType: string;
  sourceId: string;
};

export type RecordExternalOutboundResult = {
  ok: boolean;
  conversationId?: string;
  messageId?: string;
  skipped?: "no_relationship" | "empty_body";
  error?: string;
};

async function resolveRelationshipId(
  supabase: AdminLike,
  input: RecordExternalOutboundInput,
): Promise<string | null> {
  if (input.relationshipId) return input.relationshipId;

  if (input.clientId) {
    const { data } = await supabase
      .from("clients")
      .select("relationship_id")
      .eq("id", input.clientId)
      .maybeSingle();
    if (data?.relationship_id) return data.relationship_id as string;
  }

  if (input.leadId) {
    const { data } = await supabase
      .from("leads")
      .select("relationship_id")
      .eq("id", input.leadId)
      .maybeSingle();
    if (data?.relationship_id) return data.relationship_id as string;
  }

  return null;
}

async function findOrCreateConversation(
  supabase: AdminLike,
  venueId: string,
  relationshipId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("relationship_id", relationshipId)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ venue_id: venueId, relationship_id: relationshipId })
    .select("id")
    .single();
  if (error || !created?.id) return null;
  return created.id as string;
}

/**
 * After a successful external send to a client, mirror it into the
 * relationship conversation as sender_type=system (automated venue outbound).
 */
export async function recordExternalClientOutbound(
  supabase: AdminLike,
  input: RecordExternalOutboundInput,
): Promise<RecordExternalOutboundResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, skipped: "empty_body" };

  const relationshipId = await resolveRelationshipId(supabase, input);
  if (!relationshipId) return { ok: false, skipped: "no_relationship" };

  const conversationId = await findOrCreateConversation(
    supabase,
    input.venueId,
    relationshipId,
  );
  if (!conversationId) {
    return { ok: false, error: "Could not open conversation for relationship." };
  }

  const { data, error } = await supabase
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      venue_id: input.venueId,
      sender_type: "system",
      channel: input.channel,
      body,
      provider_id: input.providerId ?? null,
      status: input.status ?? "accepted",
      channel_metadata: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        automated: true,
      },
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, conversationId, messageId: data?.id as string | undefined };
}
