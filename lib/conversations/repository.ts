/**
 * Conversation data access layer — Program 2, Phase 2A.
 * The ONLY place that calls the conversation RPCs directly. Server-only.
 *
 * Unlike lib/leads/repository.ts, these RPCs are SECURITY DEFINER and
 * resolve the caller's venue internally via current_user_venue_id() (venue
 * side) or the portal token (couple side) — callers here never pass a
 * venueId. Real repository/service layering on purpose: TR-C2's couple-chat
 * side called RPCs directly from API routes with no layer in between;
 * Conversation doesn't repeat that.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  ConversationDetail,
  ConversationMessage,
  ConversationMessagePreview,
  ConversationSummary,
  PortalConversationDetail,
  PortalConversationMessage,
} from "@/lib/conversations/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type InboxConversationRow = {
  id: string;
  relationship_id: string;
  display_name: string | null;
  last_message_at: string | null;
  venue_unread: number;
  contact_unread: number;
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  lead_id: string | null;
  client_id: string | null;
  latest_message: {
    body: string; sender_type: ConversationMessagePreview["senderType"]; sent_at: string;
    channel: ConversationMessagePreview["channel"];
  } | null;
};

function mapInboxRow(r: InboxConversationRow): ConversationSummary {
  return {
    id: r.id,
    relationshipId: r.relationship_id,
    displayName: r.display_name,
    lastMessageAt: r.last_message_at,
    venueUnread: r.venue_unread,
    contactUnread: r.contact_unread,
    assignedStaffId: r.assigned_staff_id,
    assignedStaffName: r.assigned_staff_name,
    leadId: r.lead_id,
    clientId: r.client_id,
    latestMessage: r.latest_message
      ? { body: r.latest_message.body, senderType: r.latest_message.sender_type, sentAt: r.latest_message.sent_at, channel: r.latest_message.channel }
      : null,
  };
}

export async function getConversationInbox(
  client: DbClient,
): Promise<{ conversations: ConversationSummary[]; totalUnread: number }> {
  const { data, error } = await client.rpc("get_conversation_inbox");
  if (error) throw error;
  if (!data || "error" in data) return { conversations: [], totalUnread: 0 };
  const rows = (data.conversations ?? []) as InboxConversationRow[];
  return { conversations: rows.map(mapInboxRow), totalUnread: data.total_unread ?? 0 };
}

export async function getConversation(
  client: DbClient,
  conversationId: string,
): Promise<ConversationDetail | null> {
  const { data, error } = await client.rpc("get_conversation", { p_conversation_id: conversationId });
  if (error) throw error;
  if (!data || "error" in data) return null;
  type Row = {
    id: string; sender_type: ConversationMessage["senderType"]; channel: ConversationMessage["channel"];
    body: string; sent_at: string; venue_read_at: string | null; contact_read_at: string | null;
  };
  const messages = ((data.messages ?? []) as Row[]).map((m): ConversationMessage => ({
    id: m.id, senderType: m.sender_type, channel: m.channel, body: m.body,
    sentAt: m.sent_at, venueReadAt: m.venue_read_at, contactReadAt: m.contact_read_at,
  }));
  return { conversationId: data.conversation_id, messages };
}

export async function sendConversationMessage(
  client: DbClient,
  conversationId: string,
  body: string,
  channel: string = "portal",
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { data, error } = await client.rpc("send_conversation_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_channel: channel,
  });
  if (error) throw error;
  return { ok: data?.ok ?? false, messageId: data?.message_id, error: data?.error };
}

/**
 * Resolves which Relationship a Conversation anchors to (Scheduled Sends,
 * 2026-07-14) — the inverse of getConversationIdForRelationship, needed
 * because scheduled_messages is stored per-relationship (matching
 * conversations itself) while the compose UI only knows its conversationId.
 */
export async function getRelationshipIdForConversation(
  client: DbClient,
  conversationId: string,
): Promise<string | null> {
  const { data } = await client.from("conversations")
    .select("relationship_id").eq("id", conversationId).maybeSingle<{ relationship_id: string | null }>();
  return data?.relationship_id ?? null;
}

/**
 * Assigned Coordinator (Communication Workspace Completion) — a plain
 * RLS-scoped update, same reasoning as every other narrow conversations
 * read/write in this file: the caller already has an authenticated venue
 * session, so no SECURITY DEFINER RPC is needed.
 */
export async function setConversationAssignedStaff(
  client: DbClient,
  conversationId: string,
  staffId: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("conversations") as any)
    .update({ assigned_staff_id: staffId }).eq("id", conversationId);
  if (error) throw error;
}

/**
 * Resolves the phone number to text for a conversation's counterparty (SMS,
 * 2026-07-11). A Conversation always anchors to exactly one
 * venue_customer_relationship (never a vendor relationship, for this path) —
 * the relationship itself carries no phone, so this looks it up from
 * whichever of leads/clients is linked to that relationship. A plain
 * RLS-scoped read, not an RPC — matches getConversationIdForRelationship's
 * reasoning: the caller already has an authenticated venue session.
 */
export async function getConversationRecipientPhone(
  client: DbClient,
  conversationId: string,
): Promise<string | null> {
  const { data: convo } = await client.from("conversations")
    .select("relationship_id").eq("id", conversationId).maybeSingle<{ relationship_id: string | null }>();
  if (!convo?.relationship_id) return null;

  const { data: lead } = await client.from("leads")
    .select("phone").eq("relationship_id", convo.relationship_id).maybeSingle<{ phone: string | null }>();
  if (lead?.phone) return lead.phone;

  const { data: client_ } = await client.from("clients")
    .select("phone").eq("relationship_id", convo.relationship_id).maybeSingle<{ phone: string | null }>();
  return client_?.phone ?? null;
}

/**
 * Resolves the email address to send to for a conversation's counterparty
 * (fixing the immediate "Email" channel, 2026-07-14 — it looked like it
 * worked but only ever wrote to the database). Unlike phone, the
 * relationship itself already carries email directly — no lead/client join
 * needed.
 */
export async function getConversationRecipientEmail(
  client: DbClient,
  conversationId: string,
): Promise<string | null> {
  const { data: convo } = await client.from("conversations")
    .select("relationship_id").eq("id", conversationId).maybeSingle<{ relationship_id: string | null }>();
  if (!convo?.relationship_id) return null;

  const { data: relationship } = await client.from("venue_customer_relationships")
    .select("email").eq("id", convo.relationship_id).maybeSingle<{ email: string | null }>();
  return relationship?.email ?? null;
}

/**
 * Program 2 Phase 2B — resolves the one Conversation for a Relationship,
 * for surfaces (like the Lead/Client detail page) that already know which
 * relationship they're looking at and just need its conversation_id. A
 * plain RLS-scoped table read, not an RPC — the caller already has an
 * authenticated venue session, so there's nothing a SECURITY DEFINER
 * function would add here.
 */
export async function getConversationIdForRelationship(
  client: DbClient,
  relationshipId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("conversations")
    .select("id")
    .eq("relationship_id", relationshipId)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data?.id ?? null;
}

export async function getConversationUnreadCount(client: DbClient): Promise<number> {
  const { data, error } = await client.rpc("get_conversation_unread_count");
  if (error) throw error;
  return data?.count ?? 0;
}

export async function getPortalConversation(
  client: DbClient,
  token: string,
): Promise<PortalConversationDetail | { error: string }> {
  const { data, error } = await client.rpc("get_portal_conversation", { p_token: token });
  if (error) throw error;
  if (!data || data.error) return { error: data?.error ?? "unknown_error" };
  type Row = { id: string; sender_type: PortalConversationMessage["senderType"]; body: string; sent_at: string; contact_read_at: string | null };
  const messages = ((data.messages ?? []) as Row[]).map((m): PortalConversationMessage => ({
    id: m.id, senderType: m.sender_type, body: m.body, sentAt: m.sent_at, contactReadAt: m.contact_read_at,
  }));
  return { conversationId: data.conversation_id, messages };
}

export async function sendPortalConversationMessage(
  client: DbClient,
  token: string,
  body: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { data, error } = await client.rpc("send_portal_conversation_message", { p_token: token, p_body: body });
  if (error) throw error;
  return { ok: data?.ok ?? false, messageId: data?.message_id, error: data?.error };
}
