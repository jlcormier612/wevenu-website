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
  VendorConversationDetail,
  VendorConversationMessage,
  VendorConversationSummary,
  VendorRollupConversation,
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
    status: string | null; failure_reason: string | null;
    channel_metadata: Record<string, unknown> | null;
    attachments: { id: string; fileUrl: string; fileName: string; fileSize: number | null; mimeType: string | null }[];
  };
  const messages = ((data.messages ?? []) as Row[]).map((m): ConversationMessage => ({
    id: m.id, senderType: m.sender_type, channel: m.channel, body: m.body,
    sentAt: m.sent_at, venueReadAt: m.venue_read_at, contactReadAt: m.contact_read_at,
    status: m.status, failureReason: m.failure_reason,
    channelMetadata: m.channel_metadata ?? null,
    attachments: m.attachments ?? [],
  }));
  return { conversationId: data.conversation_id, messages };
}

/**
 * RC2 — every attachment across a Conversation, for the Relationship
 * Context Panel's "Files" list. A plain RLS-scoped read (the attachments
 * table's own policy already resolves back to conversation_messages.venue_id
 * = current_user_venue_id()) — no RPC needed, same reasoning as every other
 * narrow read in this file.
 */
export async function getConversationAttachments(
  client: DbClient,
  conversationId: string,
): Promise<{ id: string; fileUrl: string; fileName: string; fileSize: number | null; mimeType: string | null; sentAt: string }[]> {
  const { data, error } = await client
    .from("conversation_message_attachments")
    .select("id, file_url, file_name, file_size, mime_type, conversation_messages!inner(conversation_id, sent_at)")
    .eq("conversation_messages.conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = { id: string; file_url: string; file_name: string; file_size: number | null; mime_type: string | null; conversation_messages: { sent_at: string } | { sent_at: string }[] };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const msg = Array.isArray(r.conversation_messages) ? r.conversation_messages[0] : r.conversation_messages;
    return { id: r.id, fileUrl: r.file_url, fileName: r.file_name, fileSize: r.file_size, mimeType: r.mime_type, sentAt: msg?.sent_at ?? "" };
  });
}

/** RC2 — attaches an already-uploaded file to a message (venue side). */
export async function addConversationMessageAttachment(
  client: DbClient,
  messageId: string,
  file: { url: string; name: string; size?: number | null; mimeType?: string | null },
): Promise<{ ok: boolean; attachmentId?: string; error?: string }> {
  const { data, error } = await client.rpc("add_conversation_message_attachment", {
    p_message_id: messageId,
    p_file_url: file.url,
    p_file_name: file.name,
    p_file_size: file.size ?? null,
    p_mime_type: file.mimeType ?? null,
  });
  if (error) throw error;
  return { ok: data?.ok ?? false, attachmentId: data?.attachment_id, error: data?.error };
}

export async function sendConversationMessage(
  client: DbClient,
  conversationId: string,
  body: string,
  channel: string = "portal",
  providerId?: string | null,
  status?: string | null,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { data, error } = await client.rpc("send_conversation_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_channel: channel,
    p_provider_id: providerId ?? null,
    p_status: status ?? null,
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
    .select("relationship_id, event_vendor_assignment_id")
    .eq("id", conversationId)
    .maybeSingle<{ relationship_id: string | null; event_vendor_assignment_id: string | null }>();

  // RC2, Milestone 3 — a vendor-anchored Conversation has no relationship_id;
  // its counterparty's phone lives on the vendor itself, reached through the
  // event assignment this Conversation is anchored to.
  if (convo?.event_vendor_assignment_id) {
    const { data } = await client.from("event_vendor_assignments")
      .select("vendors(phone)").eq("id", convo.event_vendor_assignment_id)
      .maybeSingle<{ vendors: { phone: string | null } | { phone: string | null }[] | null }>();
    const vendor = Array.isArray(data?.vendors) ? data.vendors[0] : data?.vendors;
    return vendor?.phone ?? null;
  }

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
    .select("relationship_id, event_vendor_assignment_id")
    .eq("id", conversationId)
    .maybeSingle<{ relationship_id: string | null; event_vendor_assignment_id: string | null }>();

  // RC2, Milestone 3 — vendor-anchored Conversation: same reasoning as
  // getConversationRecipientPhone above.
  if (convo?.event_vendor_assignment_id) {
    const { data } = await client.from("event_vendor_assignments")
      .select("vendors(email)").eq("id", convo.event_vendor_assignment_id)
      .maybeSingle<{ vendors: { email: string | null } | { email: string | null }[] | null }>();
    const vendor = Array.isArray(data?.vendors) ? data.vendors[0] : data?.vendors;
    return vendor?.email ?? null;
  }

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
  type Row = {
    id: string; sender_type: PortalConversationMessage["senderType"]; body: string; sent_at: string;
    contact_read_at: string | null; venue_read_at: string | null;
    attachments: { id: string; fileUrl: string; fileName: string; fileSize: number | null; mimeType: string | null }[];
  };
  const messages = ((data.messages ?? []) as Row[]).map((m): PortalConversationMessage => ({
    id: m.id, senderType: m.sender_type, body: m.body, sentAt: m.sent_at,
    contactReadAt: m.contact_read_at, venueReadAt: m.venue_read_at,
    attachments: m.attachments ?? [],
  }));
  return { conversationId: data.conversation_id, messages };
}

export async function sendPortalConversationMessage(
  client: DbClient,
  token: string,
  body: string,
  hasAttachment = false,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { data, error } = await client.rpc("send_portal_conversation_message", {
    p_token: token, p_body: body, p_has_attachment: hasAttachment,
  });
  if (error) throw error;
  return { ok: data?.ok ?? false, messageId: data?.message_id, error: data?.error };
}

/** RC2 — attaches an already-uploaded file to a message (portal/couple side). */
export async function addPortalConversationMessageAttachment(
  client: DbClient,
  token: string,
  messageId: string,
  file: { url: string; name: string; size?: number | null; mimeType?: string | null },
): Promise<{ ok: boolean; attachmentId?: string; error?: string }> {
  const { data, error } = await client.rpc("add_portal_conversation_message_attachment", {
    p_token: token,
    p_message_id: messageId,
    p_file_url: file.url,
    p_file_name: file.name,
    p_file_size: file.size ?? null,
    p_mime_type: file.mimeType ?? null,
  });
  if (error) throw error;
  return { ok: data?.ok ?? false, attachmentId: data?.attachment_id, error: data?.error };
}

// ── RC2, Milestone 3 — vendor conversations (event-anchored) ────────────────

/**
 * Resolves an event-vendor-assignment's Conversation id (venue side) — the
 * vendor-scoped analogue of getConversationIdForRelationship, for the
 * "Message [Vendor]" affordance inside an Event's vendor-assignment view.
 */
export async function getConversationIdForEventVendorAssignment(
  client: DbClient,
  assignmentId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc("get_conversation_id_for_event_vendor_assignment", {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
  return data ?? null;
}

type RollupRow = {
  conversation_id: string; event_id: string; event_name: string; event_date: string | null;
  last_message_at: string | null; venue_unread: number;
  latest_message: { body: string; sender_type: ConversationMessagePreview["senderType"]; sent_at: string } | null;
};

function mapRollupRow(r: RollupRow): VendorRollupConversation {
  return {
    conversationId: r.conversation_id,
    eventId: r.event_id,
    eventName: r.event_name,
    eventDate: r.event_date,
    lastMessageAt: r.last_message_at,
    venueUnread: r.venue_unread,
    latestMessage: r.latest_message
      ? { body: r.latest_message.body, senderType: r.latest_message.sender_type, sentAt: r.latest_message.sent_at, channel: "portal" }
      : null,
  };
}

/** Venue side — "every conversation we've ever had with this vendor," for the Vendor detail page. */
export async function getVendorRelationshipRollup(
  client: DbClient,
  vendorRelationshipId: string,
): Promise<VendorRollupConversation[]> {
  const { data, error } = await client.rpc("get_vendor_relationship_rollup", {
    p_vendor_relationship_id: vendorRelationshipId,
  });
  if (error) throw error;
  if (!data || "error" in data) return [];
  return ((data.conversations ?? []) as RollupRow[]).map(mapRollupRow);
}

type VendorInboxRow = {
  conversation_id: string; event_id: string; event_name: string; event_date: string | null;
  last_message_at: string | null; contact_unread: number;
  latest_message: { body: string; sender_type: ConversationMessagePreview["senderType"]; sent_at: string } | null;
};

/** Vendor side — the vendor portal's event-grouped Messages inbox. */
export async function getVendorConversationInbox(
  client: DbClient,
): Promise<{ conversations: VendorConversationSummary[]; totalUnread: number }> {
  const { data, error } = await client.rpc("get_vendor_conversation_inbox");
  if (error) throw error;
  if (!data || "error" in data) return { conversations: [], totalUnread: 0 };
  const rows = (data.conversations ?? []) as VendorInboxRow[];
  return {
    conversations: rows.map((r): VendorConversationSummary => ({
      conversationId: r.conversation_id, eventId: r.event_id, eventName: r.event_name, eventDate: r.event_date,
      lastMessageAt: r.last_message_at, contactUnread: r.contact_unread,
      latestMessage: r.latest_message
        ? { body: r.latest_message.body, senderType: r.latest_message.sender_type, sentAt: r.latest_message.sent_at, channel: "portal" }
        : null,
    })),
    totalUnread: data.total_unread ?? 0,
  };
}

export async function getVendorConversation(
  client: DbClient,
  conversationId: string,
): Promise<VendorConversationDetail | null> {
  const { data, error } = await client.rpc("get_vendor_conversation", { p_conversation_id: conversationId });
  if (error) throw error;
  if (!data || "error" in data) return null;
  type Row = { id: string; sender_type: VendorConversationMessage["senderType"]; body: string; sent_at: string; contact_read_at: string | null; venue_read_at: string | null };
  const messages = ((data.messages ?? []) as Row[]).map((m): VendorConversationMessage => ({
    id: m.id, senderType: m.sender_type, body: m.body, sentAt: m.sent_at,
    contactReadAt: m.contact_read_at, venueReadAt: m.venue_read_at,
  }));
  return { conversationId: data.conversation_id, messages };
}

export async function sendVendorConversationMessage(
  client: DbClient,
  conversationId: string,
  body: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { data, error } = await client.rpc("send_vendor_conversation_message", {
    p_conversation_id: conversationId, p_body: body,
  });
  if (error) throw error;
  return { ok: data?.ok ?? false, messageId: data?.message_id, error: data?.error };
}
