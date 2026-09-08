/**
 * Communication Trust Experience — the one, shared plain-English vocabulary
 * for the message status lifecycle. Every surface that shows a message's
 * status (the bubble badge, Message History, Luv) reads from here, so a
 * venue owner never sees different words for the same underlying fact —
 * and never sees different words for email vs. SMS, which share this exact
 * lifecycle (opened/clicked simply never occur for SMS; that's a fact
 * about the channel, not a different vocabulary).
 */
export type MessageStatusMeta = { emoji: string; label: string };

export const MESSAGE_STATUS_META: Record<string, MessageStatusMeta> = {
  draft:       { emoji: "📝", label: "Draft" },
  sending:     { emoji: "⏳", label: "Sending" },
  accepted:    { emoji: "📤", label: "Sent" },
  delivered:   { emoji: "🟢", label: "Delivered" },
  opened:      { emoji: "👀", label: "Opened" },
  clicked:     { emoji: "🖱️", label: "Clicked" },
  replied:     { emoji: "💬", label: "Replied" },
  failed:      { emoji: "❌", label: "Couldn't deliver" },
  undelivered: { emoji: "⚠️", label: "Not delivered" },
  received:    { emoji: "📥", label: "Received" },
};

/** Statuses that mean the message did not successfully reach the recipient. */
export function isDeliveryFailureStatus(status: string | null | undefined): boolean {
  return status === "failed" || status === "undelivered";
}

/** Channels that can show opened/clicked — never invent Read for SMS. */
export function channelSupportsReadState(channel: string | null | undefined): boolean {
  return channel === "email";
}
