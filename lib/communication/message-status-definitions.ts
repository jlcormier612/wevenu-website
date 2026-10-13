/**
 * Customer-facing message status definitions for Communication Readiness.
 * Verified against provider webhooks and UI labels in:
 *   - app/api/messaging/webhook/route.ts (Resend → status)
 *   - app/api/messaging/sms-status/route.ts (Twilio → status)
 *   - lib/communication/status-labels.ts (UI vocabulary)
 *   - app/api/messaging/inbound/route.ts + sms-inbound (Received / Replied)
 */

export type MessageStatusDefinition = {
  key: string;
  label: string;
  definition: string;
};

/** Compact definitions shown beside Communication Readiness setup guidance. */
export const MESSAGE_STATUS_DEFINITIONS: MessageStatusDefinition[] = [
  {
    key: "sent",
    label: "Sent",
    definition:
      "The sending system accepted the send request. This does not necessarily mean the message reached the recipient’s inbox.",
  },
  {
    key: "delivered",
    label: "Delivered",
    definition:
      "The email or texting provider reported the message as delivered. This does not mean the recipient read it.",
  },
  {
    key: "opened",
    label: "Opened",
    definition:
      "An email-open tracking event was recorded. This is an indicative tracking signal, not proof that the recipient personally read the email — email clients and privacy features can affect tracking.",
  },
  {
    key: "clicked",
    label: "Clicked",
    definition:
      "A tracked link-click event was recorded on an email. This does not prove that the recipient completed the action on the destination page.",
  },
  {
    key: "received",
    label: "Received",
    definition:
      "An incoming message from a client or contact has arrived in Hello to Cheers.",
  },
  {
    key: "replied",
    label: "Replied",
    definition:
      "An incoming message was matched to the relevant conversation, and the prior outbound message was marked Replied.",
  },
  {
    key: "needs_attention",
    label: "Couldn't deliver",
    definition:
      "The provider reported a bounce or undelivered outcome. These are the messages counted as needing attention.",
  },
];

/** Email-only engagement — never invent Read for SMS. */
export const EMAIL_ENGAGEMENT_NOTE =
  "Opened and Clicked apply to email only — not texts. They are provider tracking signals when open/click tracking is available, not proof someone personally read the message or finished a linked action. Privacy features can suppress opens.";
/**
 * Dashboard tile semantics (last N days, outbound only):
 * - Sent = every non-draft outbound row (includes accepted/sending and later states)
 * - Delivered = delivered, opened, clicked, or replied
 * - Needs attention = failed or undelivered
 * Pending acceptance (accepted/sending) sits in Sent, not Delivered, and not Needs attention.
 */
export const DASHBOARD_COUNT_NOTE =
  "Sent counts every outbound message submitted in the window. Delivered counts those the provider confirmed (including later Opened, Clicked, or Replied). Messages still waiting on a delivery confirmation stay in Sent only — they are not “needs attention” unless they fail.";
