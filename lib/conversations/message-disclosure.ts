/**
 * Progressive disclosure for conversation message history.
 * Newest/current message is expanded; older messages start collapsed.
 * Independent of Inbox list ordering and Upcoming Tours sorting.
 */
import type { ConversationChannel, ConversationMessage } from "@/lib/conversations/types";

const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  email: "Email",
  sms: "Text",
  portal: "Portal",
  internal_note: "Internal note",
  phone_log: "Phone call",
  voicemail: "Voicemail",
  push: "Push",
};

export function latestConversationMessageId(
  messages: Pick<ConversationMessage, "id">[],
): string | null {
  return messages[0]?.id ?? null;
}

/** Latest message is always treated as expanded/current. */
export function isConversationMessageExpanded(
  messageId: string,
  latestId: string | null,
  manuallyExpandedIds: ReadonlySet<string>,
): boolean {
  if (latestId && messageId === latestId) return true;
  return manuallyExpandedIds.has(messageId);
}

export function conversationMessagePreview(body: string, maxLen = 72): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

export function conversationMessageSenderLabel(
  msg: Pick<ConversationMessage, "senderType">,
): string {
  switch (msg.senderType) {
    case "venue_staff":
      return "You";
    case "system":
      return "Automated";
    case "lead_or_client":
      return "Them";
    case "contact":
      return "Contact";
    case "vendor":
      return "Vendor";
    default:
      return "Message";
  }
}

export function conversationMessageChannelLabel(
  channel: ConversationMessage["channel"],
): string {
  return CHANNEL_LABELS[channel] ?? channel;
}
