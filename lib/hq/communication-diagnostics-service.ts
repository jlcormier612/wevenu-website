/**
 * Communication Diagnostics — Communication Trust Experience, Phase 7.
 *
 * Administrator-only. Everything Phase 2's plain-English Communication
 * Health deliberately hides — raw provider payloads, webhook history,
 * queue status — lives here instead, for support/troubleshooting a
 * specific venue, never for everyday coordinator use. Reads via the
 * `<table>_hq_select` RLS policies added alongside this (Postgres RLS
 * policies are additive — this doesn't touch the venue's own access).
 */
import { createClient } from "@/integrations/supabase/server";
import { isEmailConfigured } from "@/lib/email/send";
import { isSmsConfigured } from "@/lib/sms/send";

export type DiagnosticEvent = {
  id: string;
  source: "legacy" | "conversation";
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown> | null;
};

export type CommunicationDiagnostics = {
  authStatus: { emailConfigured: boolean; smsConfigured: boolean };
  queue: { pending: number; overdue: number };
  events: DiagnosticEvent[];
};

export async function getVenueCommunicationDiagnostics(venueId: string): Promise<CommunicationDiagnostics> {
  const client = await createClient();
  const nowIso = new Date().toISOString();

  const [legacyEvents, conversationEvents, scheduled] = await Promise.all([
    client.from("message_events")
      .select("id, event_type, occurred_at, payload, messages!inner(venue_id)")
      .eq("messages.venue_id", venueId)
      .order("occurred_at", { ascending: false })
      .limit(40),
    client.from("conversation_message_events")
      .select("id, event_type, occurred_at, payload, conversation_messages!inner(venue_id)")
      .eq("conversation_messages.venue_id", venueId)
      .order("occurred_at", { ascending: false })
      .limit(40),
    client.from("scheduled_messages")
      .select("status, scheduled_for")
      .eq("venue_id", venueId).eq("status", "scheduled"),
  ]);

  type EventRow = { id: string; event_type: string; occurred_at: string; payload: Record<string, unknown> | null };

  const legacy: DiagnosticEvent[] = ((legacyEvents.data ?? []) as unknown as EventRow[]).map((e) => ({
    id: e.id, source: "legacy", eventType: e.event_type, occurredAt: e.occurred_at, payload: e.payload,
  }));
  const conversation: DiagnosticEvent[] = ((conversationEvents.data ?? []) as unknown as EventRow[]).map((e) => ({
    id: e.id, source: "conversation", eventType: e.event_type, occurredAt: e.occurred_at, payload: e.payload,
  }));

  const scheduledRows = (scheduled.data ?? []) as { status: string; scheduled_for: string }[];

  return {
    authStatus: { emailConfigured: isEmailConfigured(), smsConfigured: isSmsConfigured() },
    queue: {
      pending: scheduledRows.length,
      overdue: scheduledRows.filter((r) => r.scheduled_for < nowIso).length,
    },
    events: [...legacy, ...conversation]
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
      .slice(0, 50),
  };
}
