/**
 * Minimal email send priority for Resend team-rate coordination.
 *
 * critical — access, auth, contracts, payments, booking-critical notices
 * bulk — sequences, digests, guest blasts, lower-priority automation
 */

export type EmailSendPriority = "critical" | "bulk";

/**
 * Stable category ids for inventory / ops. Priority is derived from category
 * unless a caller overrides.
 */
export type EmailSendCategory =
  | "password_recovery"
  | "account_invite"
  | "client_portal_invite"
  | "vendor_invite"
  | "team_invite"
  | "contract_signature"
  | "payment_notice"
  | "booking_notice"
  | "tour_notice"
  | "conversation_message"
  | "message_alert"
  | "questionnaire"
  | "proposal"
  | "brochure"
  | "enrollment_lifecycle"
  | "ops_internal"
  | "feedback_ops"
  | "task_reminder"
  | "tour_reminder"
  | "obligation_reminder"
  | "venue_notification"
  | "scheduled_sequence"
  | "guest_rsvp_invite"
  | "digest"
  | "saved_report"
  | "referral"
  | "sms_consent"
  | "readiness_test"
  | "inquiry_ack"
  | "form_submission"
  | "event_order"
  | "inventory_choice"
  | "client_choice"
  | "participant_invite"
  | "onboarding_ops"
  | "uncategorized"
  | "generic_transactional";

/**
 * Uncategorized / omitted category defaults to bulk so historical callers
 * cannot silently consume critical reserved capacity.
 */
export const DEFAULT_SEND_CATEGORY: EmailSendCategory = "uncategorized";

const CRITICAL_CATEGORIES = new Set<EmailSendCategory>([
  "password_recovery",
  "account_invite",
  "client_portal_invite",
  "vendor_invite",
  "team_invite",
  "contract_signature",
  "payment_notice",
  "booking_notice",
  "tour_notice",
  "enrollment_lifecycle",
  "ops_internal",
  "proposal",
  "questionnaire",
  "conversation_message",
  "message_alert",
  "sms_consent",
  "inquiry_ack",
  "form_submission",
  "brochure",
  "event_order",
  "inventory_choice",
  "client_choice",
  "participant_invite",
  "onboarding_ops",
  "readiness_test",
  "generic_transactional",
  "referral",
]);

export function priorityForCategory(category: EmailSendCategory): EmailSendPriority {
  return CRITICAL_CATEGORIES.has(category) ? "critical" : "bulk";
}

export function isBulkCategory(category: EmailSendCategory): boolean {
  return priorityForCategory(category) === "bulk";
}
