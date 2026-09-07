/**
 * Inbox attention helpers — Pass 1 calm + trustworthy Inbox.
 *
 * Needs response and empty-conversation rules are derived from existing
 * message fields (sender_type / channel). No stored attention flag.
 *
 * List and thread share conversationNeedsResponse(latestMeaningful…).
 * latestMeaningfulFromMessages is the in-memory walker; Inbox rows carry
 * latestMeaningfulMessage from a scoped repository enrich so the list does
 * not depend on the tip-of-thread preview alone.
 */
import type {
  ConversationChannel,
  ConversationMessagePreview,
  ConversationSenderType,
  ConversationSummary,
} from "@/lib/conversations/types";

const INBOUND_SENDERS: ReadonlySet<ConversationSenderType> = new Set([
  "lead_or_client",
  "contact",
  "vendor",
]);

/** Channels excluded from Needs Response / meaningful-message triage. */
export const NON_MEANINGFUL_CHANNELS = [
  "internal_note",
  "phone_log",
  "voicemail",
  "push",
] as const;

/** Channels that are records/notes, not customer-facing communication for triage. */
export function isNonMeaningfulChannel(channel: ConversationChannel | string): boolean {
  return (NON_MEANINGFUL_CHANNELS as readonly string[]).includes(channel);
}

/**
 * A message participates in Needs response / empty-conversation triage when it
 * is real customer or staff communication — not system automation markers and
 * not staff-only notes/logs.
 */
export function isMeaningfulCommunication(message: {
  senderType: ConversationSenderType;
  channel: ConversationChannel | string;
}): boolean {
  if (message.senderType === "system") return false;
  if (isNonMeaningfulChannel(message.channel)) return false;
  return (
    message.senderType === "venue_staff"
    || INBOUND_SENDERS.has(message.senderType)
  );
}

/**
 * Needs response (v1): latest meaningful communication is inbound from the
 * client/contact/vendor, with no subsequent meaningful venue response.
 * Unread is a separate concept.
 */
export function conversationNeedsResponse(
  latestMeaningful: ConversationMessagePreview | null | undefined,
): boolean {
  if (!latestMeaningful) return false;
  if (!isMeaningfulCommunication(latestMeaningful)) return false;
  return INBOUND_SENDERS.has(latestMeaningful.senderType);
}

/** Walk newest→oldest and return the first meaningful preview. */
export function latestMeaningfulFromMessages(
  messages: ReadonlyArray<{ senderType: ConversationSenderType; channel: ConversationChannel; body: string; sentAt: string }>,
): ConversationMessagePreview | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (!isMeaningfulCommunication(m)) continue;
    return {
      body: m.body,
      senderType: m.senderType,
      sentAt: m.sentAt,
      channel: m.channel,
    };
  }
  return null;
}

/**
 * When the Inbox tip is already meaningful, it *is* the latest meaningful
 * message — no deeper lookup required. Non-meaningful tips need a batch lookup.
 */
export function latestMeaningfulFromInboxTip(
  latestMessage: ConversationMessagePreview | null,
): { status: "known"; value: ConversationMessagePreview | null } | { status: "needs_lookup" } {
  if (!latestMessage) return { status: "known", value: null };
  if (isMeaningfulCommunication(latestMessage)) return { status: "known", value: latestMessage };
  return { status: "needs_lookup" };
}

/**
 * Rows must be newest-first overall (or at least contiguous per conversation
 * with newer rows first). Takes the first meaningful row per conversation.
 */
export function pickLatestMeaningfulPerConversation(
  rows: ReadonlyArray<{
    conversationId: string;
    senderType: ConversationSenderType;
    channel: ConversationChannel | string;
    body: string;
    sentAt: string;
  }>,
): Map<string, ConversationMessagePreview> {
  const map = new Map<string, ConversationMessagePreview>();
  for (const row of rows) {
    if (map.has(row.conversationId)) continue;
    if (!isMeaningfulCommunication(row)) continue;
    map.set(row.conversationId, {
      body: row.body,
      senderType: row.senderType,
      sentAt: row.sentAt,
      channel: row.channel as ConversationChannel,
    });
  }
  return map;
}

/**
 * Inbox list rows: only conversations with at least one real message preview.
 * Empty relationship shells stay provisioned but out of the normal Inbox.
 */
export function conversationBelongsInInbox(conversation: Pick<ConversationSummary, "latestMessage">): boolean {
  return conversation.latestMessage != null;
}

/**
 * Authoritative Needs Response for an Inbox row — same rule as the thread.
 * Requires latestMeaningfulMessage from repository enrich (or optimistic patch).
 */
export function conversationNeedsResponseFromSummary(
  conversation: Pick<ConversationSummary, "latestMeaningfulMessage">,
): boolean {
  return conversationNeedsResponse(conversation.latestMeaningfulMessage ?? null);
}
