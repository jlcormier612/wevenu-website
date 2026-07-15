/**
 * Message Template Library domain types — Communication Platform Phase 1.
 * See docs/communication-platform-next-phase.md §2.
 */

export type MessageTemplateCategory =
  | "inquiry_follow_up"
  | "tour"
  | "booking_confirmation"
  | "planning_reminder"
  | "payment_reminder"
  | "vendor_coordination"
  | "post_event"
  | "general";

export type MessageTemplate = {
  id: string;
  venueId: string;
  name: string;
  category: MessageTemplateCategory;
  // Email variant — both null if this template has no email version.
  emailSubject: string | null;
  emailBody: string | null;
  // SMS variant — no subject, by design (§2.5). Null if no SMS version.
  smsBody: string | null;
  // Archive, not hard-delete, is the default removal path — matching
  // Planning/Timeline/Floor Plan Templates (Template Platform — Release
  // Readiness parity pass).
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MessageTemplateInput = {
  name: string;
  category: MessageTemplateCategory;
  emailSubject: string;
  emailBody: string;
  smsBody: string;
};

export type MessageTemplateErrors = Record<string, string>;

export type MessageTemplateActionResult =
  | { ok: true }
  | { ok: false; errors?: MessageTemplateErrors; message?: string };

export type CreateMessageTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; errors?: MessageTemplateErrors; message?: string };
