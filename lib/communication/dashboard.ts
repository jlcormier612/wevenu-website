/**
 * Communication Health Dashboard — Communication Trust Experience, Phase 4.
 *
 * Intentionally simple, per the guiding brief: plain counts ("241 messages
 * sent, 240 delivered, 1 needs attention"), never a bare percentage.
 * Overall Communication Health (reuses Phase 2's computation) is kept
 * separate from Individual Message History — two different questions
 * ("can I trust this today" vs. "what actually happened to this message").
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { getCommunicationHealth, type CommunicationHealth } from "@/lib/communication/health";

const WINDOW_DAYS = 30;

export type CommunicationCounts = {
  windowDays: number;
  sent: number;
  delivered: number;
  needsAttention: number;
};

export type MessageHistoryItem = {
  id: string;
  source: "legacy" | "conversation";
  channel: "email" | "sms";
  direction: "outbound" | "inbound";
  status: string | null;
  failureReason: string | null;
  recipientName: string | null;
  preview: string;
  occurredAt: string;
  leadId: string | null;
  clientId: string | null;
};

export type CommunicationDashboardData = {
  health: CommunicationHealth;
  counts: CommunicationCounts;
  history: MessageHistoryItem[];
};

const EMPTY: CommunicationDashboardData = {
  health: { level: "excellent", headline: "Excellent", detail: "Everything is working normally.", issues: [] },
  counts: { windowDays: WINDOW_DAYS, sent: 0, delivered: 0, needsAttention: 0 },
  history: [],
};

type DbClient = Awaited<ReturnType<typeof createClient>>;

// "Delivered successfully" reads, to a venue owner, as "the whole chain
// worked" — opened/clicked/replied are all a delivered message that then
// did even better, not a different outcome.
const DELIVERED_LIKE = new Set(["delivered", "opened", "clicked", "replied"]);

export async function getCommunicationDashboardData(): Promise<CommunicationDashboardData> {
  if (!isSupabaseConfigured) return EMPTY;
  const venue = await getCurrentVenue();
  if (!venue) return EMPTY;

  const client = await createClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [health, counts, history] = await Promise.all([
    getCommunicationHealth(),
    getCounts(client, venue.id, since),
    getHistory(client, venue.id),
  ]);

  return { health, counts, history };
}

async function getCounts(client: DbClient, venueId: string, since: string): Promise<CommunicationCounts> {
  const [legacy, conversation] = await Promise.all([
    client.from("messages")
      .select("status")
      .eq("venue_id", venueId).eq("direction", "outbound")
      .neq("status", "draft")
      .gte("created_at", since),
    client.from("conversation_messages")
      .select("status")
      .eq("venue_id", venueId).in("sender_type", ["venue_staff", "system"])
      .not("status", "is", null)
      .gte("sent_at", since),
  ]);
  const rows = [...(legacy.data ?? []), ...(conversation.data ?? [])] as { status: string | null }[];
  return {
    windowDays: WINDOW_DAYS,
    sent: rows.length,
    delivered: rows.filter((r) => r.status && DELIVERED_LIKE.has(r.status)).length,
    needsAttention: rows.filter((r) => r.status === "failed").length,
  };
}

async function getHistory(client: DbClient, venueId: string): Promise<MessageHistoryItem[]> {
  type LegacyRow = {
    id: string; direction: "outbound" | "inbound"; status: string | null; error_message: string | null;
    body: string; created_at: string; from_name: string | null;
    message_threads: { lead_id: string | null; client_id: string | null; entity_name?: string } | { lead_id: string | null; client_id: string | null }[] | null;
  };
  const [legacy, conversation] = await Promise.all([
    client.from("messages")
      .select("id, direction, status, error_message, body, created_at, from_name, message_threads(lead_id, client_id)")
      .eq("venue_id", venueId).eq("channel", "email")
      .order("created_at", { ascending: false })
      .limit(30),
    client.from("conversation_messages")
      .select("id, sender_type, channel, status, failure_reason, body, sent_at, conversation_id")
      .eq("venue_id", venueId).in("channel", ["email", "sms"])
      .order("sent_at", { ascending: false })
      .limit(30),
  ]);

  const legacyItems: MessageHistoryItem[] = ((legacy.data ?? []) as unknown as LegacyRow[]).map((m) => {
    const thread = Array.isArray(m.message_threads) ? m.message_threads[0] : m.message_threads;
    return {
      id: m.id, source: "legacy", channel: "email", direction: m.direction === "inbound" ? "inbound" : "outbound",
      status: m.status, failureReason: m.error_message, recipientName: null, preview: m.body.slice(0, 80),
      occurredAt: m.created_at, leadId: thread?.lead_id ?? null, clientId: thread?.client_id ?? null,
    };
  });

  type ConvRow = {
    id: string; sender_type: string; channel: string; status: string | null; failure_reason: string | null;
    body: string; sent_at: string; conversation_id: string;
  };
  const convRows = (conversation.data ?? []) as unknown as ConvRow[];

  const conversationIds = [...new Set(convRows.map((m) => m.conversation_id))];
  const nameByConversation = new Map<string, string>();
  const leadByConversation = new Map<string, string>();
  const clientByConversation = new Map<string, string>();
  if (conversationIds.length > 0) {
    const { data: conversations } = await client.from("conversations")
      .select("id, relationship_id").in("id", conversationIds);
    const relationshipByConversation = new Map(
      ((conversations ?? []) as { id: string; relationship_id: string | null }[])
        .filter((c) => c.relationship_id)
        .map((c) => [c.id, c.relationship_id!]),
    );
    const relationshipIds = [...new Set(relationshipByConversation.values())];
    if (relationshipIds.length > 0) {
      const [{ data: relationships }, { data: leads }, { data: clients }] = await Promise.all([
        client.from("venue_customer_relationships").select("id, first_name, last_name").in("id", relationshipIds),
        client.from("leads").select("id, relationship_id").in("relationship_id", relationshipIds),
        client.from("clients").select("id, relationship_id").in("relationship_id", relationshipIds),
      ]);
      const nameByRelationship = new Map(
        ((relationships ?? []) as { id: string; first_name: string | null; last_name: string | null }[])
          .map((r) => [r.id, [r.first_name, r.last_name].filter(Boolean).join(" ") || null]),
      );
      const leadByRelationship = new Map(((leads ?? []) as { id: string; relationship_id: string }[]).map((l) => [l.relationship_id, l.id]));
      const clientByRelationship = new Map(((clients ?? []) as { id: string; relationship_id: string }[]).map((c) => [c.relationship_id, c.id]));
      for (const [convId, relId] of relationshipByConversation) {
        const name = nameByRelationship.get(relId);
        if (name) nameByConversation.set(convId, name);
        const leadId = leadByRelationship.get(relId);
        if (leadId) leadByConversation.set(convId, leadId);
        const clientId = clientByRelationship.get(relId);
        if (clientId) clientByConversation.set(convId, clientId);
      }
    }
  }

  const conversationItems: MessageHistoryItem[] = convRows.map((m) => ({
    id: m.id, source: "conversation", channel: m.channel === "sms" ? "sms" : "email",
    direction: m.sender_type === "venue_staff" || m.sender_type === "system" ? "outbound" : "inbound",
    status: m.status, failureReason: m.failure_reason, recipientName: nameByConversation.get(m.conversation_id) ?? null,
    preview: m.body.slice(0, 80), occurredAt: m.sent_at,
    leadId: leadByConversation.get(m.conversation_id) ?? null,
    clientId: clientByConversation.get(m.conversation_id) ?? null,
  }));

  return [...legacyItems, ...conversationItems]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .slice(0, 50);
}
