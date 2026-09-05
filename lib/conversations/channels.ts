/**
 * Conversation channels that a venue may choose as a Send action.
 * The database enum also includes phone_log / voicemail / push for
 * historical rows — those must never appear as sendable actions.
 *
 * Outbound channels (email / sms / portal) are the customer-facing send
 * options. Internal note is sendable but must be presented as a separate
 * staff-only mode — never as another outbound channel in the same picker.
 */

export const OUTBOUND_CHANNELS = ["email", "sms", "portal"] as const;
export type OutboundChannel = (typeof OUTBOUND_CHANNELS)[number];

export const SENDABLE_CHANNELS = ["email", "sms", "portal", "internal_note"] as const;
export type SendableChannel = (typeof SENDABLE_CHANNELS)[number];

/** Never shown to couple/vendor portals; never increment client unread. */
export const STAFF_ONLY_CHANNELS = ["internal_note", "phone_log", "voicemail", "push"] as const;
export type StaffOnlyChannel = (typeof STAFF_ONLY_CHANNELS)[number];

export function isOutboundChannel(channel: string): channel is OutboundChannel {
  return (OUTBOUND_CHANNELS as readonly string[]).includes(channel);
}

export function isSendableChannel(channel: string): channel is SendableChannel {
  return (SENDABLE_CHANNELS as readonly string[]).includes(channel);
}

export function isStaffOnlyChannel(channel: string): channel is StaffOnlyChannel {
  return (STAFF_ONLY_CHANNELS as readonly string[]).includes(channel);
}

/** Channels a couple or vendor is allowed to see in a conversation. */
export function isClientVisibleChannel(channel: string): boolean {
  return !isStaffOnlyChannel(channel);
}

export const OUTBOUND_CHANNEL_LABEL: Record<OutboundChannel, string> = {
  email: "Email",
  sms: "Text",
  portal: "Portal message",
};

export const SENDABLE_CHANNEL_LABEL: Record<SendableChannel, string> = {
  ...OUTBOUND_CHANNEL_LABEL,
  internal_note: "Internal note",
};
