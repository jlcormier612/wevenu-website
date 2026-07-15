/**
 * Communication Health — Communication Trust Experience, Phase 2.
 *
 * The one question this answers, in plain English: "can I trust Wevenu to
 * communicate with my clients today?" No SPF/DKIM/webhook/DNS language
 * belongs here — that's Phase 7's diagnostics view. This reads the status
 * lifecycle built in Phase 3 (lib/communication/status.ts) and turns it
 * into a single traffic-light state plus the short list of real, current
 * problems behind it.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isEmailConfigured } from "@/lib/email/send";
import { isSmsConfigured } from "@/lib/sms/send";
import { getCurrentVenue } from "@/lib/venue/service";

export type CommunicationHealthLevel = "excellent" | "attention" | "action_required";

export type CommunicationHealthIssue = {
  id: string;
  channel: "email" | "sms";
  reason: string;
  occurredAt: string;
  leadId: string | null;
  clientId: string | null;
};

export type CommunicationHealth = {
  level: CommunicationHealthLevel;
  headline: string;
  detail: string;
  issues: CommunicationHealthIssue[];
};

const LOOKBACK_DAYS = 7;
// A handful of bad numbers is normal life for a venue; a third or more of
// everything failing in the same week is a systemic problem (a provider
// outage, an expired credential), not a run of typos — worth naming
// differently in plain language rather than just piling up "Needs Attention".
const SYSTEMIC_FAILURE_RATIO = 0.34;
const SYSTEMIC_FAILURE_MIN_ATTEMPTS = 5;

type DbClient = Awaited<ReturnType<typeof createClient>>;

async function countRecentAttempts(
  client: DbClient, venueId: string, since: string,
): Promise<{ total: number; failed: number }> {
  const [legacy, conversation] = await Promise.all([
    client.from("messages")
      .select("status", { count: "exact", head: false })
      .eq("venue_id", venueId).eq("direction", "outbound")
      .neq("status", "draft")
      .gte("created_at", since),
    client.from("conversation_messages")
      .select("status", { count: "exact", head: false })
      .eq("venue_id", venueId).in("sender_type", ["venue_staff", "system"])
      .not("status", "is", null)
      .gte("sent_at", since),
  ]);
  const rows = [...(legacy.data ?? []), ...(conversation.data ?? [])] as { status: string | null }[];
  return { total: rows.length, failed: rows.filter((r) => r.status === "failed").length };
}

async function getRecentIssues(client: DbClient, venueId: string, since: string): Promise<CommunicationHealthIssue[]> {
  const [legacy, conversation] = await Promise.all([
    client.from("messages")
      .select("id, error_message, updated_at, thread_id, message_threads(lead_id, client_id)")
      .eq("venue_id", venueId).eq("status", "failed")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(20),
    client.from("conversation_messages")
      .select("id, channel, failure_reason, sent_at, conversation_id")
      .eq("venue_id", venueId).eq("status", "failed")
      .gte("sent_at", since)
      .order("sent_at", { ascending: false })
      .limit(20),
  ]);

  type LegacyRow = {
    id: string; error_message: string | null; updated_at: string;
    message_threads: { lead_id: string | null; client_id: string | null } | { lead_id: string | null; client_id: string | null }[] | null;
  };
  const legacyIssues: CommunicationHealthIssue[] = ((legacy.data ?? []) as unknown as LegacyRow[]).map((m) => {
    const thread = Array.isArray(m.message_threads) ? m.message_threads[0] : m.message_threads;
    return {
      id: m.id, channel: "email", reason: m.error_message ?? "Your message couldn't be delivered.",
      occurredAt: m.updated_at, leadId: thread?.lead_id ?? null, clientId: thread?.client_id ?? null,
    };
  });

  type ConvRow = { id: string; channel: string; failure_reason: string | null; sent_at: string; conversation_id: string };
  const convRows = (conversation.data ?? []) as unknown as ConvRow[];

  // Conversation issues carry a conversation_id, not a lead/client id — one
  // batch lookup resolves them all to whichever record they should link to,
  // rather than a round trip per failed message.
  const conversationIds = [...new Set(convRows.map((m) => m.conversation_id))];
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
      const [{ data: leads }, { data: clients }] = await Promise.all([
        client.from("leads").select("id, relationship_id").in("relationship_id", relationshipIds),
        client.from("clients").select("id, relationship_id").in("relationship_id", relationshipIds),
      ]);
      const leadByRelationship = new Map(((leads ?? []) as { id: string; relationship_id: string }[]).map((l) => [l.relationship_id, l.id]));
      const clientByRelationship = new Map(((clients ?? []) as { id: string; relationship_id: string }[]).map((c) => [c.relationship_id, c.id]));
      for (const [convId, relId] of relationshipByConversation) {
        const leadId = leadByRelationship.get(relId);
        if (leadId) leadByConversation.set(convId, leadId);
        const clientId = clientByRelationship.get(relId);
        if (clientId) clientByConversation.set(convId, clientId);
      }
    }
  }

  const conversationIssues: CommunicationHealthIssue[] = convRows.map((m) => ({
    id: m.id, channel: m.channel === "sms" ? "sms" : "email",
    reason: m.failure_reason ?? "Your message couldn't be delivered.",
    occurredAt: m.sent_at,
    leadId: leadByConversation.get(m.conversation_id) ?? null,
    clientId: clientByConversation.get(m.conversation_id) ?? null,
  }));

  return [...legacyIssues, ...conversationIssues]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .slice(0, 10);
}

export async function getCommunicationHealth(): Promise<CommunicationHealth> {
  const emailConfigured = isEmailConfigured();
  const smsConfigured = isSmsConfigured();

  if (!emailConfigured && !smsConfigured) {
    return {
      level: "action_required",
      headline: "Action Required",
      detail: "Messages can't be delivered right now — email and texting aren't finished setting up yet. Contact support to get this resolved.",
      issues: [],
    };
  }

  if (!isSupabaseConfigured) {
    return { level: "excellent", headline: "Excellent", detail: "Everything is working normally.", issues: [] };
  }

  const venue = await getCurrentVenue();
  if (!venue) return { level: "excellent", headline: "Excellent", detail: "Everything is working normally.", issues: [] };

  const client = await createClient();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ total, failed }, issues] = await Promise.all([
    countRecentAttempts(client, venue.id, since),
    getRecentIssues(client, venue.id, since),
  ]);

  if (total >= SYSTEMIC_FAILURE_MIN_ATTEMPTS && failed / total >= SYSTEMIC_FAILURE_RATIO) {
    return {
      level: "action_required",
      headline: "Action Required",
      detail: `${failed} of your last ${total} messages couldn't be delivered — this looks bigger than a few bad addresses. Contact support to get this resolved.`,
      issues,
    };
  }

  if (issues.length > 0) {
    return {
      level: "attention",
      headline: "Needs Attention",
      detail: `${issues.length} message${issues.length === 1 ? "" : "s"} couldn't be delivered in the last week — take a look below.`,
      issues,
    };
  }

  const partialNote = !emailConfigured ? " (texting only — email isn't set up yet)"
    : !smsConfigured ? " (email only — texting isn't set up yet)" : "";
  return {
    level: "excellent",
    headline: "Excellent",
    detail: `Everything is working normally${partialNote}.`,
    issues: [],
  };
}
