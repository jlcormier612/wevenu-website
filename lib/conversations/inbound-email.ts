/**
 * Inbound email → conversation_messages.
 *
 * Replies to Conversation composer emails use Reply-To subaddressing
 * (`thread+{conversationId}@…`). Matching and recording live here so the
 * webhook route stays thin and the send → reply → conversation flow is
 * unit-testable. This writes the current Conversations system of record —
 * not the legacy messages / message_threads tables.
 */
import { shouldAdvanceStatus } from "@/lib/communication/status";

export function parseFromEmail(from: string): { email: string; name: string | null } {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || null, email: match[2].trim() };
  return { name: null, email: from.trim() };
}

export function extractConversationIdFromTo(toAddresses: string[]): string | null {
  for (const addr of toAddresses) {
    const match = addr.match(/thread\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i);
    if (match) return match[1];
  }
  return null;
}

export function providerIdFromInReplyTo(inReplyTo: string): string {
  return inReplyTo.replace(/[<>]/g, "").trim().split("@")[0] ?? "";
}

/**
 * Keep the couple's new reply; drop the prior message mail clients append.
 * Matches Apple Mail / Gmail "On <date>, <name> wrote:", Outlook
 * "-----Original Message-----", and trailing ">" quoted lines.
 */
export function stripEmailReplyQuotes(body: string): string {
  const normalized = body.replace(/\r\n/g, "\n");
  if (!normalized.trim()) return "";

  const lines = normalized.split("\n");
  let cutAt = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    // "On Monday, November 2, 2026 at 11:36:03 PM EST, Hello to Cheers <…> wrote:"
    if (/^On\s+\S[\s\S]*\bwrote:\s*$/i.test(line)) {
      cutAt = i;
      break;
    }
    // Header and remainder on one line
    if (/^On\s+\S.+\bwrote:\s+\S/i.test(line)) {
      cutAt = i;
      break;
    }
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line)) {
      cutAt = i;
      break;
    }
    if (/^_{5,}\s*$/.test(line)) {
      cutAt = i;
      break;
    }
  }

  const kept = lines.slice(0, cutAt);

  // Strip trailing ">" quote blocks and blank lines from the kept prefix.
  while (kept.length > 0) {
    const last = kept[kept.length - 1]!.trim();
    if (!last || /^>/.test(last)) {
      kept.pop();
      continue;
    }
    break;
  }

  const result = kept.join("\n").trim();
  return result || normalized.trim();
}

export type InboundEmailMatch = {
  conversationId: string;
  venueId: string;
  relationshipId: string | null;
  entityType: "lead" | "client" | null;
  entityId: string | null;
};

type ConversationAnchor = {
  id: string;
  venue_id: string;
  relationship_id: string | null;
};

type RelationshipEntity = {
  id: string;
  venue_id: string;
  relationship_id: string | null;
};

/** Minimal surface the inbound matcher needs — production uses the admin client. */
export type InboundEmailStore = {
  findConversationById(id: string): Promise<ConversationAnchor | null>;
  findConversationMessageByProviderId(providerId: string): Promise<{ conversation_id: string } | null>;
  findLegacyMessageByProviderId(providerId: string): Promise<{ thread_id: string } | null>;
  findLegacyThread(threadId: string): Promise<{
    venue_id: string;
    lead_id: string | null;
    client_id: string | null;
  } | null>;
  findLeadByEmail(email: string): Promise<RelationshipEntity | null>;
  findClientByEmail(email: string): Promise<RelationshipEntity | null>;
  findConversationForRelationship(relationshipId: string): Promise<ConversationAnchor | null>;
  findConversationForLead(leadId: string): Promise<ConversationAnchor | null>;
  findConversationForClient(clientId: string): Promise<ConversationAnchor | null>;
};

export async function resolveInboundEmailConversation(
  store: InboundEmailStore,
  input: { toAddresses: string[]; inReplyTo: string | null; fromEmail: string },
): Promise<InboundEmailMatch | null> {
  const fromSubaddress = extractConversationIdFromTo(input.toAddresses);
  if (fromSubaddress) {
    const conversation = await store.findConversationById(fromSubaddress);
    if (conversation) return matchFromConversation(conversation);
    // Older emails used a legacy message_threads id in the same Reply-To shape.
    const legacy = await matchFromLegacyThread(store, fromSubaddress);
    if (legacy) return legacy;
  }

  if (input.inReplyTo) {
    const providerId = providerIdFromInReplyTo(input.inReplyTo);
    const conversationMsg = await store.findConversationMessageByProviderId(providerId);
    if (conversationMsg) {
      const conversation = await store.findConversationById(conversationMsg.conversation_id);
      if (conversation) return matchFromConversation(conversation);
    }
    const legacyMsg = await store.findLegacyMessageByProviderId(providerId);
    if (legacyMsg) {
      const legacy = await matchFromLegacyThread(store, legacyMsg.thread_id);
      if (legacy) return legacy;
    }
  }

  const lead = await store.findLeadByEmail(input.fromEmail);
  if (lead) {
    const conversation = lead.relationship_id
      ? await store.findConversationForRelationship(lead.relationship_id)
      : await store.findConversationForLead(lead.id);
    if (conversation) {
      return {
        conversationId: conversation.id,
        venueId: conversation.venue_id,
        relationshipId: conversation.relationship_id ?? lead.relationship_id,
        entityType: "lead",
        entityId: lead.id,
      };
    }
  }

  const client = await store.findClientByEmail(input.fromEmail);
  if (client) {
    const conversation = client.relationship_id
      ? await store.findConversationForRelationship(client.relationship_id)
      : await store.findConversationForClient(client.id);
    if (conversation) {
      return {
        conversationId: conversation.id,
        venueId: conversation.venue_id,
        relationshipId: conversation.relationship_id ?? client.relationship_id,
        entityType: "client",
        entityId: client.id,
      };
    }
  }

  return null;
}

function matchFromConversation(conversation: ConversationAnchor): InboundEmailMatch {
  return {
    conversationId: conversation.id,
    venueId: conversation.venue_id,
    relationshipId: conversation.relationship_id,
    entityType: null,
    entityId: null,
  };
}

async function matchFromLegacyThread(
  store: InboundEmailStore,
  threadId: string,
): Promise<InboundEmailMatch | null> {
  const thread = await store.findLegacyThread(threadId);
  if (!thread) return null;
  if (thread.lead_id) {
    const conversation = await store.findConversationForLead(thread.lead_id);
    if (conversation) {
      return {
        conversationId: conversation.id,
        venueId: conversation.venue_id,
        relationshipId: conversation.relationship_id,
        entityType: "lead",
        entityId: thread.lead_id,
      };
    }
  }
  if (thread.client_id) {
    const conversation = await store.findConversationForClient(thread.client_id);
    if (conversation) {
      return {
        conversationId: conversation.id,
        venueId: conversation.venue_id,
        relationshipId: conversation.relationship_id,
        entityType: "client",
        entityId: thread.client_id,
      };
    }
  }
  return null;
}

export type InboundEmailRecorder = {
  insertConversationMessage(row: {
    conversation_id: string;
    venue_id: string;
    sender_type: "lead_or_client";
    channel: "email";
    body: string;
    status: "received";
  }): Promise<{ ok: true } | { ok: false; message: string }>;
  findLatestOutboundEmail(conversationId: string): Promise<{ id: string; status: string | null } | null>;
  markMessageReplied(messageId: string): Promise<void>;
  logRepliedEvent(messageId: string): Promise<void>;
};

export async function recordInboundConversationEmail(
  recorder: InboundEmailRecorder,
  match: InboundEmailMatch,
  body: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const inserted = await recorder.insertConversationMessage({
    conversation_id: match.conversationId,
    venue_id: match.venueId,
    sender_type: "lead_or_client",
    channel: "email",
    body: stripEmailReplyQuotes(body),
    status: "received",
  });
  if (!inserted.ok) return inserted;

  const lastOutbound = await recorder.findLatestOutboundEmail(match.conversationId);
  if (lastOutbound && shouldAdvanceStatus(lastOutbound.status, "replied")) {
    await recorder.markMessageReplied(lastOutbound.id);
    await recorder.logRepliedEvent(lastOutbound.id);
  }
  return { ok: true };
}
