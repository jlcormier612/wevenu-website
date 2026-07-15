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
  draft:     { emoji: "📝", label: "Draft" },
  sending:   { emoji: "⏳", label: "Sending" },
  accepted:  { emoji: "📤", label: "Sent" },
  delivered: { emoji: "🟢", label: "Delivered" },
  opened:    { emoji: "👀", label: "Opened" },
  clicked:   { emoji: "🖱️", label: "Clicked" },
  replied:   { emoji: "💬", label: "Replied" },
  failed:    { emoji: "❌", label: "Couldn't deliver" },
  received:  { emoji: "📥", label: "Received" },
};
