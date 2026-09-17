/**
 * Stamp / update venue_couple conversation Inbox ownership.
 */
import { VENUE_COUPLE_CONVERSATION_KIND } from "@/lib/conversations/venue-couple-conversation";
import type { InboxOwnerKind } from "@/lib/conversations/inbox-ownership";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export async function setVenueCoupleInboxOwner(
  client: AnyDb,
  input: {
    venueId: string;
    relationshipId: string;
    ownerKind: InboxOwnerKind;
    leadId?: string | null;
    clientId?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    inbox_owner_kind: input.ownerKind,
    inbox_owner_lead_id: input.ownerKind === "lead" ? (input.leadId ?? null) : null,
    inbox_owner_client_id: input.ownerKind === "client" ? (input.clientId ?? null) : null,
  };
  const { error } = await client
    .from("conversations")
    .update(patch)
    .eq("venue_id", input.venueId)
    .eq("relationship_id", input.relationshipId)
    .eq("conversation_kind", VENUE_COUPLE_CONVERSATION_KIND);
  if (error) {
    console.error("Could not stamp conversation inbox ownership:", error.message);
  }
}
