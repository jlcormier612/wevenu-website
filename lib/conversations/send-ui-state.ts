/**
 * Pure helpers for conversation send UI — separate authoritative send from
 * post-send refresh so a refresh/transport failure cannot look like a send failure.
 */

import type {
  ConversationChannel,
  ConversationMessage,
  SendMessageResult,
} from "@/lib/conversations/types";

export type SentMessageAck = {
  messageId: string;
  channel: string;
  body: string;
  status?: string | null;
};

/** Authoritative send succeeded — safe to clear the composer. */
export function isAuthoritativeSendSuccess(
  result: SendMessageResult,
): result is Extract<SendMessageResult, { ok: true }> {
  return result.ok === true && !!result.messageId;
}

/**
 * After an authoritative send, a refresh/onSent failure must not become a
 * send-failure confirmation. Returns the confirmation kind for the composer.
 */
export function confirmationAfterSend(input: {
  sendOk: boolean;
  refreshFailed: boolean;
  channel: string;
  sendErrorMessage?: string;
}):
  | { kind: "sent"; channel: string }
  | { kind: "failed"; message: string } {
  if (!input.sendOk) {
    return {
      kind: "failed",
      message: input.sendErrorMessage?.trim() || "Could not send message.",
    };
  }
  // Refresh failure is degradation only — message already left Hello to Cheers.
  void input.refreshFailed;
  return { kind: "sent", channel: input.channel };
}

export function toSentMessageAck(
  result: Extract<SendMessageResult, { ok: true }>,
  body: string,
  fallbackChannel: string,
): SentMessageAck {
  return {
    messageId: result.messageId,
    channel: result.channel ?? fallbackChannel,
    body,
    status: result.status ?? null,
  };
}

const KNOWN_CHANNELS = new Set<string>([
  "email",
  "sms",
  "portal",
  "internal_note",
  "phone_log",
  "voicemail",
  "push",
]);

/** Optimistic thread row when getConversation refresh fails after a known send. */
export function optimisticMessageFromAck(ack: SentMessageAck, sentAt = new Date().toISOString()): ConversationMessage {
  const channel = (KNOWN_CHANNELS.has(ack.channel) ? ack.channel : "email") as ConversationChannel;
  return {
    id: ack.messageId,
    senderType: "venue_staff",
    channel,
    body: ack.body,
    sentAt,
    venueReadAt: sentAt,
    contactReadAt: null,
    status: ack.status ?? "accepted",
    failureReason: null,
    channelMetadata: null,
    attachments: [],
  };
}

/** Merge an ack into the local thread without duplicating by messageId. */
export function mergeSentAckIntoMessages(
  prev: ConversationMessage[] | null,
  ack: SentMessageAck,
): ConversationMessage[] {
  const list = prev ?? [];
  if (list.some((m) => m.id === ack.messageId)) return list;
  return [...list, optimisticMessageFromAck(ack)];
}
