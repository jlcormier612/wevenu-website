/**
 * Conversation domain types — Program 2, Phase 2A.
 * Pure types — no framework or database imports.
 *
 * Not wired into any UI yet. This is the backend foundation Phase 2B's UI
 * cutover will consume; see docs/program-2-implementation-plan.md.
 */

export type ConversationSenderType = "venue_staff" | "lead_or_client" | "contact" | "vendor" | "system";
export type ConversationChannel =
  | "email" | "sms" | "portal" | "internal_note" | "phone_log" | "voicemail" | "push";

export type ConversationMessagePreview = {
  body: string;
  senderType: ConversationSenderType;
  sentAt: string;
  channel: ConversationChannel;
};

export type ConversationSummary = {
  id: string;
  relationshipId: string;
  displayName: string | null;
  lastMessageAt: string | null;
  venueUnread: number;
  contactUnread: number;
  latestMessage: ConversationMessagePreview | null;
  // Communication Workspace Completion — Inbox filtering/cards/shortcuts.
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  // The originating Lead (Client shortcut) and, once booked, the Client/
  // Booking Workspace record (Booking shortcut) — a Relationship may carry
  // both at once.
  leadId: string | null;
  clientId: string | null;
};

export type ConversationMessageAttachment = {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
};

export type ConversationMessage = {
  id: string;
  senderType: ConversationSenderType;
  channel: ConversationChannel;
  body: string;
  sentAt: string;
  venueReadAt: string | null;
  contactReadAt: string | null;
  // Communication Trust Experience — null for record-only channels (portal,
  // internal_note, phone_log, voicemail) where no provider is ever involved.
  status: string | null;
  failureReason: string | null;
  // RC2 — { sequenceEnrollmentId } for a sender_type:'system' message, so
  // the UI can explain *why* it was automated, not just that it was.
  channelMetadata: Record<string, unknown> | null;
  attachments: ConversationMessageAttachment[];
};

export type ConversationDetail = {
  conversationId: string;
  messages: ConversationMessage[];
};

export type PortalConversationMessage = {
  id: string;
  senderType: ConversationSenderType;
  body: string;
  sentAt: string;
  contactReadAt: string | null;
  venueReadAt: string | null;
  attachments: ConversationMessageAttachment[];
};

export type PortalConversationDetail = {
  conversationId: string;
  messages: PortalConversationMessage[];
};

export type SendMessageResult =
  | { ok: true; messageId: string }
  | { ok: false; message: string };

export type PortalConversationResult =
  | { ok: true; conversation: PortalConversationDetail }
  | { ok: false; message: string };

// ── RC2, Milestone 3 — vendor conversations (event-anchored) ────────────────

/** One event-anchored vendor conversation, as seen from the venue side's rollup. */
export type VendorRollupConversation = {
  conversationId: string;
  eventId: string;
  eventName: string;
  eventDate: string | null;
  lastMessageAt: string | null;
  venueUnread: number;
  latestMessage: ConversationMessagePreview | null;
};

/** The vendor portal's inbox row — one per event they're assigned to. */
export type VendorConversationSummary = {
  conversationId: string;
  eventId: string;
  eventName: string;
  eventDate: string | null;
  lastMessageAt: string | null;
  contactUnread: number;
  latestMessage: ConversationMessagePreview | null;
};

export type VendorConversationMessage = {
  id: string;
  senderType: ConversationSenderType;
  body: string;
  sentAt: string;
  contactReadAt: string | null;
  venueReadAt: string | null;
};

export type VendorConversationDetail = {
  conversationId: string;
  messages: VendorConversationMessage[];
};

export type VendorConversationResult =
  | { ok: true; conversation: VendorConversationDetail }
  | { ok: false; message: string };
