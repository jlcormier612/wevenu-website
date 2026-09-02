/**
 * Conversation channels that a venue may choose as a Send action.
 * The database enum also includes phone_log / voicemail / push for
 * historical rows — those must never appear as sendable actions.
 */

export const SENDABLE_CHANNELS = ["email", "sms", "portal", "internal_note"] as const;
export type SendableChannel = (typeof SENDABLE_CHANNELS)[number];

/** Never shown to couple/vendor portals; never increment client unread. */
export const STAFF_ONLY_CHANNELS = ["internal_note", "phone_log", "voicemail", "push"] as const;
export type StaffOnlyChannel = (typeof STAFF_ONLY_CHANNELS)[number];

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

export const SENDABLE_CHANNEL_LABEL: Record<SendableChannel, string> = {
  email: "Email",
  sms: "SMS",
  portal: "Portal message",
  internal_note: "Internal note",
};
