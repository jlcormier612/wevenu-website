/**
 * Scheduled Sends data access layer — Communication Platform Phase 2.
 * Venue-side functions use the authenticated server client (RLS-scoped).
 * getDueBatch/markSent/markFailed are called by the processor with the
 * admin client (no user session in a cron context) — same pattern already
 * established for the SMS inbound webhook.
 */
import { createClient } from "@/integrations/supabase/server";
import type { createAdminClient } from "@/integrations/supabase/admin";
import type { MergeContext } from "@/lib/message-templates/merge";
import type { ScheduledMessage, ScheduledMessageInput } from "@/lib/scheduled-messages/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;
type AnyDbClient = DbClient | ReturnType<typeof createAdminClient>;

type ScheduledMessageRow = {
  id: string; venue_id: string; relationship_id: string; template_id: string | null;
  channel: ScheduledMessage["channel"]; email_subject: string | null; body: string;
  scheduled_for: string; status: ScheduledMessage["status"]; sent_at: string | null;
  error_message: string | null; created_at: string; sequence_enrollment_id: string | null;
};

function mapScheduledMessage(r: ScheduledMessageRow): ScheduledMessage {
  return {
    id: r.id, venueId: r.venue_id, relationshipId: r.relationship_id, templateId: r.template_id,
    channel: r.channel, emailSubject: r.email_subject, body: r.body,
    scheduledFor: r.scheduled_for, status: r.status, sentAt: r.sent_at,
    errorMessage: r.error_message, createdAt: r.created_at,
    sequenceEnrollmentId: r.sequence_enrollment_id,
  };
}

export async function insertScheduledMessage(client: DbClient, venueId: string, input: ScheduledMessageInput): Promise<string> {
  const { data, error } = await client.from("scheduled_messages")
    .insert({
      venue_id: venueId,
      relationship_id: input.relationshipId,
      template_id: input.templateId,
      channel: input.channel,
      email_subject: input.channel === "email" ? (input.emailSubject.trim() || null) : null,
      body: input.body,
      scheduled_for: input.scheduledFor,
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function getScheduledForRelationship(client: DbClient, venueId: string, relationshipId: string): Promise<ScheduledMessage[]> {
  const { data, error } = await client.from("scheduled_messages").select("*")
    .eq("venue_id", venueId).eq("relationship_id", relationshipId).eq("status", "scheduled")
    .order("scheduled_for");
  if (error) throw error;
  return (data as ScheduledMessageRow[]).map(mapScheduledMessage);
}

/** "Scheduled Today" tile on the Communication Dashboard (Communication Workspace Completion) — reuses the existing scheduled_messages table, no new state. */
export async function getScheduledCountForToday(client: DbClient, venueId: string): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const { count, error } = await client.from("scheduled_messages")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId).eq("status", "scheduled")
    .gte("scheduled_for", startOfDay).lt("scheduled_for", endOfDay);
  if (error) throw error;
  return count ?? 0;
}

export async function cancelScheduledMessage(client: DbClient, venueId: string, id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("scheduled_messages") as any)
    .update({ status: "cancelled" })
    .eq("id", id).eq("venue_id", venueId).eq("status", "scheduled");
  if (error) throw error;
}

// ---- Processor (admin client, no user session) -----------------------------

export async function getDueBatch(client: AnyDbClient, limit = 50): Promise<ScheduledMessage[]> {
  const { data, error } = await client.from("scheduled_messages").select("*")
    .eq("status", "scheduled").lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for").limit(limit);
  if (error) throw error;
  return (data as ScheduledMessageRow[]).map(mapScheduledMessage);
}

export async function markSent(client: AnyDbClient, id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("scheduled_messages") as any)
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailed(client: AnyDbClient, id: string, errorMessage: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("scheduled_messages") as any)
    .update({ status: "failed", error_message: errorMessage.slice(0, 500) })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Resolves merge-field context for a relationship — venue name, the
 * counterparty's display name (whichever of lead/client is linked, matching
 * getConversationRecipientPhone's lookup order), and the event date if one
 * exists (a client's linked event, or a lead's own tentative event_date —
 * Sales Series are a primary pre-booking capability per the approved design,
 * so a lead without a booked event should still get a real date when it has
 * one on file).
 */
export async function getMergeContextForRelationship(
  client: AnyDbClient, venueId: string, relationshipId: string,
): Promise<MergeContext | null> {
  const { data: venue } = await client.from("venues").select("name").eq("id", venueId).maybeSingle<{ name: string }>();
  const { data: staff } = await client.from("venue_staff").select("full_name")
    .eq("venue_id", venueId).eq("is_owner", true).maybeSingle<{ full_name: string }>();

  type PersonRow = {
    first_name: string; last_name: string;
    partner_first_name: string | null; partner_last_name: string | null;
    event_date: string | null;
  };
  const displayName = (p: PersonRow) => {
    const primary = `${p.first_name} ${p.last_name}`.trim();
    const partner = p.partner_first_name || p.partner_last_name
      ? `${p.partner_first_name ?? ""} ${p.partner_last_name ?? ""}`.trim()
      : null;
    return partner ? `${primary} & ${partner}` : primary;
  };

  const { data: client_ } = await client.from("clients")
    .select("first_name, last_name, partner_first_name, partner_last_name, id")
    .eq("relationship_id", relationshipId).maybeSingle<PersonRow & { id: string }>();

  if (client_) {
    const { data: event } = await client.from("events")
      .select("event_date").eq("client_id", client_.id).eq("venue_id", venueId)
      .not("status", "in", "(cancelled,complete)").order("event_date").limit(1)
      .maybeSingle<{ event_date: string | null }>();
    return {
      venueName: venue?.name ?? "",
      clientName: displayName(client_),
      coordinatorName: staff?.full_name ?? venue?.name ?? "",
      eventDate: event?.event_date ?? null,
    };
  }

  const { data: lead } = await client.from("leads")
    .select("first_name, last_name, partner_first_name, partner_last_name, event_date")
    .eq("relationship_id", relationshipId).maybeSingle<PersonRow>();
  if (lead) {
    return {
      venueName: venue?.name ?? "",
      clientName: displayName(lead),
      coordinatorName: staff?.full_name ?? venue?.name ?? "",
      eventDate: lead.event_date,
    };
  }

  return null;
}

/**
 * Delivery address for a relationship — kept separate from
 * getMergeContextForRelationship on purpose: one resolves what to *display*
 * in a message, this resolves where to actually *send* it. The relationship
 * itself carries email directly; phone still requires the lead/client join
 * (same lookup order as getConversationRecipientPhone, by relationship_id
 * instead of conversationId here since the processor works from
 * scheduled_messages, which stores relationship_id directly).
 */
export async function getRecipientContactForRelationship(
  client: AnyDbClient, relationshipId: string,
): Promise<{ email: string | null; phone: string | null }> {
  const { data: relationship } = await client.from("venue_customer_relationships")
    .select("email").eq("id", relationshipId).maybeSingle<{ email: string | null }>();

  const { data: lead } = await client.from("leads")
    .select("phone").eq("relationship_id", relationshipId).maybeSingle<{ phone: string | null }>();
  if (lead?.phone) return { email: relationship?.email ?? null, phone: lead.phone };

  const { data: client_ } = await client.from("clients")
    .select("phone").eq("relationship_id", relationshipId).maybeSingle<{ phone: string | null }>();
  return { email: relationship?.email ?? null, phone: client_?.phone ?? null };
}
