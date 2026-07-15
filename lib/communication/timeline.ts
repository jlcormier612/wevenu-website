/**
 * Message Timeline — Communication Trust Experience, final piece.
 *
 * For a single message: every real transition it went through, each with
 * its own real timestamp — Created, Sent, Delivered, Opened, Clicked,
 * Replied, or Failed. "Created"/"Sent" come from the message row itself
 * (set synchronously at send time, always reliable); everything after
 * that comes from the raw provider/webhook event log
 * (message_events / conversation_message_events) built in Phase 7 —
 * this is its first coordinator-facing consumer, translated into plain
 * English instead of raw event_type strings.
 */
import { createClient } from "@/integrations/supabase/server";

export type TimelineStepKey = "created" | "sent" | "delivered" | "opened" | "clicked" | "replied" | "failed";

export type TimelineStep = {
  key: TimelineStepKey;
  label: string;
  occurredAt: string;
};

const STEP_LABEL: Record<TimelineStepKey, string> = {
  created: "Created",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  replied: "Replied",
  failed: "Couldn't deliver",
};

const STEP_ORDER: TimelineStepKey[] = ["created", "sent", "delivered", "opened", "clicked", "replied", "failed"];

// Every raw provider event_type this platform logs, mapped to the one it
// represents on the timeline. Both channels' webhooks funnel through here
// so a venue never sees "email.delivered" vs "sms.delivered" as different
// concepts — see lib/communication/status-labels.ts for the same principle
// applied to the current-status badge.
const EVENT_TYPE_TO_STEP: Record<string, TimelineStepKey> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "failed",
  "sms.queued": "sent",
  "sms.sending": "sent",
  "sms.sent": "sent",
  "sms.delivered": "delivered",
  "sms.undelivered": "failed",
  "sms.failed": "failed",
  replied: "replied",
};

type DbClient = Awaited<ReturnType<typeof createClient>>;

async function fromLegacyMessage(client: DbClient, messageId: string): Promise<TimelineStep[]> {
  const { data: message } = await client.from("messages")
    .select("created_at, sent_at, status")
    .eq("id", messageId).maybeSingle<{ created_at: string; sent_at: string | null; status: string }>();
  if (!message) return [];

  const { data: events } = await client.from("message_events")
    .select("event_type, occurred_at").eq("message_id", messageId).order("occurred_at", { ascending: true });

  return buildSteps(message.created_at, message.sent_at, message.status, (events ?? []) as { event_type: string; occurred_at: string }[]);
}

async function fromConversationMessage(client: DbClient, messageId: string): Promise<TimelineStep[]> {
  const { data: message } = await client.from("conversation_messages")
    .select("sent_at, status").eq("id", messageId).maybeSingle<{ sent_at: string; status: string | null }>();
  if (!message) return [];

  const { data: events } = await client.from("conversation_message_events")
    .select("event_type, occurred_at").eq("message_id", messageId).order("occurred_at", { ascending: true });

  // conversation_messages has no separate creation timestamp from sent_at
  // (the row is written once, synchronously, after the real send succeeds
  // or fails) — Created and Sent are honestly the same moment here, not
  // guessed at as two.
  return buildSteps(message.sent_at, message.sent_at, message.status, (events ?? []) as { event_type: string; occurred_at: string }[]);
}

function buildSteps(
  createdAt: string,
  sentAt: string | null,
  currentStatus: string | null,
  events: { event_type: string; occurred_at: string }[],
): TimelineStep[] {
  const earliest = new Map<TimelineStepKey, string>();
  const record = (key: TimelineStepKey, at: string) => {
    const existing = earliest.get(key);
    if (!existing || at < existing) earliest.set(key, at);
  };

  record("created", createdAt);
  // A message stuck at "draft"/"sending" never reached "sent" — don't
  // fabricate a step that hasn't happened yet.
  if (sentAt && currentStatus !== "draft" && currentStatus !== "sending") record("sent", sentAt);

  for (const e of events) {
    const step = EVENT_TYPE_TO_STEP[e.event_type];
    if (step) record(step, e.occurred_at);
  }

  // Stable sort: ties (e.g. Created and Sent in the same second) keep
  // STEP_ORDER's sequence rather than an arbitrary swap — the comparator
  // must return 0 for equal timestamps, not force a reordering.
  return STEP_ORDER
    .filter((key) => earliest.has(key))
    .map((key) => ({ key, label: STEP_LABEL[key], occurredAt: earliest.get(key)! }))
    .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
}

export async function getMessageTimeline(messageId: string, source: "legacy" | "conversation"): Promise<TimelineStep[]> {
  const client = await createClient();
  return source === "legacy" ? fromLegacyMessage(client, messageId) : fromConversationMessage(client, messageId);
}
