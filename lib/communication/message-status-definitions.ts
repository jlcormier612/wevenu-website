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
      "Hello to Cheers submitted the message and the delivery provider accepted it for sending. This alone does not confirm delivery to the recipient.",
  },
  {
    key: "delivered",
    label: "Delivered",
    definition:
      "The delivery provider reports that the recipient’s mail server or messaging endpoint accepted the message. It does not prove that the person opened or read it.",
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
  "Opened and Clicked are email engagement signals when tracking is available. They mean more than Delivered, not that Hello to Cheers watched someone read a text.";

/**
 * Dashboard tile semantics (last N days, outbound only):
 * - Sent = every non-draft outbound row (includes accepted/sending and later states)
 * - Delivered = delivered, opened, clicked, or replied
 * - Needs attention = failed or undelivered
 * Pending acceptance (accepted/sending) sits in Sent, not Delivered, and not Needs attention.
 */
export const DASHBOARD_COUNT_NOTE =
  "Sent counts every outbound message submitted in the window. Delivered counts those the provider confirmed (including later Opened, Clicked, or Replied). Messages still waiting on a delivery confirmation stay in Sent only — they are not “needs attention” unless they fail.";
