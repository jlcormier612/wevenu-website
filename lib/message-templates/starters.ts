/**
 * Hello to Cheers protected Message Template masters.
 *
 * These are system-owned definitions — never stored as editable venue rows.
 * New venues receive independent copies via provisionStarterMessageTemplates.
 * Venue edits never write back here.
 *
 * CONTENT IS PRODUCT-APPROVED. Do not rewrite.
 */

import type { MessageTemplateCategory } from "@/lib/message-templates/types";

export type StarterMessageMasterKey =
  | "MSG-01"
  | "MSG-02"
  | "MSG-03"
  | "MSG-04"
  | "MSG-05"
  | "MSG-06"
  | "MSG-07"
  | "MSG-08"
  | "MSG-09"
  | "MSG-10"
  | "MSG-11";

export type StarterMessageMaster = {
  key: StarterMessageMasterKey;
  name: string;
  category: MessageTemplateCategory;
  emailSubject: string;
  emailBody: string;
  /** SMS not part of the approved email starter set — empty until a venue adds one. */
  smsBody: string;
};

/**
 * MSG-02 uses the preferred production body with {{tour_datetime}} (resolved
 * from live tour context at send — never hardcoded). MSG-10 uses the
 * production payment-context body.
 */
export const STARTER_MESSAGE_MASTERS: readonly StarterMessageMaster[] = [
  {
    key: "MSG-01",
    name: "New Inquiry Response",
    category: "inquiry_follow_up",
    emailSubject: "Thank you for reaching out to {{venue_name}}",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "Thank you for reaching out to {{venue_name}}. We’re glad you’re considering us for your celebration.",
      "",
      "We’d love to learn a little more about what you’re planning and help you get a feel for the venue, our spaces, and what a celebration here can look like.",
      "",
      "If you’d like to schedule a tour, reply with a few dates that work well for you. If you’d rather start with a quick conversation, we’re happy to do that too.",
      "",
      "We look forward to learning more about your plans.",
      "",
      "Warmly,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-02",
    name: "Tour Confirmation",
    category: "tour",
    emailSubject: "Your tour at {{venue_name}} is confirmed",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "We’re looking forward to welcoming you to {{venue_name}} on {{tour_datetime}} for your tour.",
      "",
      "We’ll walk through the spaces, talk through how the venue works, and answer any questions you have about planning your celebration here.",
      "",
      "If anything changes before your visit, just reply to this message and we’ll be happy to help.",
      "",
      "See you soon,",
      "",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-03",
    name: "Tour Reminder",
    category: "tour",
    emailSubject: "A reminder about your tour at {{venue_name}}",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "We’re looking forward to seeing you at {{venue_name}} for your upcoming tour.",
      "",
      "If your plans have changed or you need to reschedule, just reply to this message and we’ll be happy to help.",
      "",
      "Otherwise, we’ll see you soon.",
      "",
      "Warmly,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-04",
    name: "Tour Follow-Up",
    category: "tour",
    emailSubject: "It was wonderful having you at {{venue_name}}",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "It was a pleasure meeting you and showing you around {{venue_name}}. We hope your visit gave you a better sense of the space and how your celebration could come together here.",
      "",
      "If you’d like to talk through your date, packages, guest count, or next steps, just reply to this message. We’re happy to help.",
      "",
      "We’d love to be part of your day.",
      "",
      "Warmly,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-05",
    name: "Proposal Follow-Up",
    category: "inquiry_follow_up",
    emailSubject: "Checking in on your proposal from {{venue_name}}",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "I wanted to check in and see if you had any questions about the proposal we shared for your celebration at {{venue_name}}.",
      "",
      "If you’d like to revisit the package, guest count, timing, or anything else, I’m happy to walk through it with you.",
      "",
      "There’s no need to figure it all out at once. When you’re ready, just reply here and we’ll take the next step together.",
      "",
      "Warmly,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-06",
    name: "Contract Reminder",
    category: "booking_confirmation",
    emailSubject: "Your agreement with {{venue_name}} is ready to review",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "Your agreement with {{venue_name}} is ready to review and sign.",
      "",
      "When you have a moment, please open the agreement through your client portal and review the details carefully. If you have any questions about the agreement or something doesn’t look right, reply to this message before signing and we’ll be happy to help.",
      "",
      "Once everything looks good, you can complete your signature through the portal.",
      "",
      "Thank you,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-07",
    name: "Final Details Reminder",
    category: "planning_reminder",
    emailSubject: "A few final details for {{event_date}}",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "Your celebration at {{venue_name}} is {{days_until_event}} days away — {{event_date}} is getting close!",
      "",
      "We’re getting everything ready on our side. When you have a moment, please complete any remaining planning items in your client portal, especially your final details, guest count, and day-of contacts.",
      "",
      "Having those details in place helps our team prepare for your celebration and make sure we’re ready for the day you’ve been planning.",
      "",
      "If you have questions or aren’t sure what still needs to be completed, just reply and we’ll walk through it with you.",
      "",
      "Warmly,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-08",
    name: "Final Guest Count Reminder",
    category: "planning_reminder",
    emailSubject: "Final guest count for {{event_date}}",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "We’re getting ready for your celebration at {{venue_name}} and need your final guest count to make sure we can prepare the right seating, rentals, and staffing.",
      "",
      "Please submit your final guest count through your client portal by the requested deadline.",
      "",
      "If you’re still waiting on a few responses or have questions about the count, just reply and let us know.",
      "",
      "Thank you,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-09",
    name: "Almost Here",
    category: "planning_reminder",
    emailSubject: "Your celebration at {{venue_name}} is almost here",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "Your celebration at {{venue_name}} is almost here — {{days_until_event}} days to go!",
      "",
      "Our team is getting ready for your day. If anything has changed with your timeline, guest count, vendors, or day-of contacts, please let us know as soon as you can so we can make sure your Event Order and day-of notes are up to date.",
      "",
      "Otherwise, take a breath and enjoy this part. We’ll take care of the venue details on our side and look forward to welcoming you.",
      "",
      "Warmly,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-10",
    name: "Payment Reminder",
    category: "payment_reminder",
    emailSubject: "Payment reminder from {{venue_name}}",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "A payment of {{payment_amount}} for your celebration at {{venue_name}} is due on {{payment_due_date}}.",
      "",
      "You can review the payment details and complete your payment through your client portal.",
      "",
      "If you’ve already taken care of it, thank you — no further action is needed.",
      "",
      "Questions about your payment plan? Just reply to this message and we’ll be happy to help.",
      "",
      "Thank you,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
  {
    key: "MSG-11",
    name: "Post-Event Thank You",
    category: "post_event",
    emailSubject: "Thank you for celebrating with us",
    emailBody: [
      "Hi {{client_name}},",
      "",
      "Thank you for celebrating with us at {{venue_name}}. It was a pleasure to be part of your day, and we hope you have many wonderful memories from your celebration.",
      "",
      "As you wrap up with your vendors and settle back into everyday life, please know that we’re here if you need anything from our team.",
      "",
      "And if you enjoyed your experience with us, we’d be grateful if you would consider sharing a short review. It means a great deal to our independent venue and helps other couples discover us.",
      "",
      "With gratitude,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n"),
    smsBody: "",
  },
] as const;

export function getStarterMessageMaster(key: string): StarterMessageMaster | undefined {
  return STARTER_MESSAGE_MASTERS.find((m) => m.key === key);
}

export function masterContentFingerprint(master: Pick<StarterMessageMaster, "emailSubject" | "emailBody" | "smsBody" | "category" | "name">): string {
  return [master.name, master.category, master.emailSubject, master.emailBody, master.smsBody ?? ""].join("\u0001");
}
