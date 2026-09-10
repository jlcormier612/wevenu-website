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
  /**
   * Latest meaningful customer/staff message (excludes system + internal notes).
   * Authoritative input for Needs Response on the Inbox list — enriched in
   * getConversationInbox, not inferred from tip-of-thread alone.
   */
  latestMeaningfulMessage?: ConversationMessagePreview | null;
  // Communication Workspace Completion — Inbox filtering/cards/shortcuts.
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  // The originating Lead (Client shortcut) and, once booked, the Client/
  // Booking Workspace record (Booking shortcut) — a Relationship may carry
  // both at once.
  leadId: string | null;
  clientId: string | null;
  /** Enrichment for Inbox search (email / phone / event date) — not shown as columns. */
  searchEmail?: string | null;
  searchPhone?: string | null;
  /**
   * Unambiguous event fields only (exactly one associated event).
   * Never populated from “earliest of many.”
   * eventId is set only when eventCount === 1.
   */
  eventCount?: number;
  eventId?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  eventType?: string | null;
  /** Lead preferred date — never labeled as Event date. */
  preferredDate?: string | null;
  leadEventType?: string | null;
  /** Has at least one conversation attachment (list cue). */
  hasAttachments?: boolean;
  /** Booking Journey stage key when enriched for filters/display. */
  bookingStage?: string | null;
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
  | {
      ok: true;
      messageId: string;
      /** Channel that was recorded — for post-send UI reconciliation only. */
      channel?: string;
      /** Delivery status at record time (e.g. accepted) — never provider jargon. */
      status?: string | null;
    }
  | { ok: false; message: string };

export type PortalConversationResult =
  | { ok: true; conversation: PortalConversationDetail }
  | { ok: false; message: string };

// ── RC2, Milestone 3 — vendor conversations (event-anchored) ────────────────

/** Pairwise conversation kinds. couple_vendor is assignment-anchored too. */
export type ConversationKind =
  | "venue_couple"
  | "venue_vendor"
  | "couple_vendor"
  | "couple_vendor_inquiry";

/** What the composer needs to show destination and channel readiness. */
export type ConversationComposeContext = {
  displayName: string | null;
  conversationKind: ConversationKind | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientPhoneDisplay: string | null;
  emailReady: boolean;
  smsReady: boolean;
  sendingDisabled: boolean;
  /** Server-side permission/suppression — null when channel is allowed. */
  smsPermissionMessage: string | null;
  emailPermissionMessage: string | null;
  /** Informational SMS permission label when send is still allowed. */
  smsPermissionHint: string | null;
  /** When SMS isn't configured yet — deep link to venue texting setup. */
  textingSetupHref: string | null;
};

export type ConversationSendPreview = {
  body: string;
  subject: string;
  html: string;
  unresolvedMessage: string | null;
};

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

/** The vendor portal's inbox row — venue↔vendor, couple↔vendor, and pre-selection inquiries. */
export type VendorConversationSummary = {
  conversationId: string;
  eventId: string | null;
  eventName: string | null;
  eventDate: string | null;
  lastMessageAt: string | null;
  contactUnread: number;
  conversationKind: "venue_vendor" | "couple_vendor" | "couple_vendor_inquiry";
  counterpartyLabel: "Venue" | "Couple";
  venueName: string | null;
  coupleName: string | null;
  latestMessage: ConversationMessagePreview | null;
};

export type VendorConversationMessage = {
  id: string;
  senderType: ConversationSenderType;
  body: string;
  sentAt: string;
  contactReadAt: string | null;
  venueReadAt: string | null;
  attachments: ConversationMessageAttachment[];
};

export type VendorConversationDetail = {
  conversationId: string;
  conversationKind: "venue_vendor" | "couple_vendor" | "couple_vendor_inquiry" | null;
  eventName: string | null;
  venueName: string | null;
  coupleName: string | null;
  counterpartyLabel: "Venue" | "Couple" | null;
  messages: VendorConversationMessage[];
};

export type VendorConversationResult =
  | { ok: true; conversation: VendorConversationDetail }
  | { ok: false; message: string };

/** Couple portal — one assigned vendor's couple↔vendor thread. */
export type PortalCoupleVendorConversationSummary = {
  conversationId: string;
  assignmentId: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string | null;
  lastMessageAt: string | null;
  coupleUnread: number;
  latestMessage: ConversationMessagePreview | null;
};

export type PortalCoupleVendorConversationDetail = {
  conversationId: string;
  vendorName: string;
  messages: PortalConversationMessage[];
};

export type PortalCoupleVendorConversationResult =
  | { ok: true; conversation: PortalCoupleVendorConversationDetail }
  | { ok: false; message: string };
