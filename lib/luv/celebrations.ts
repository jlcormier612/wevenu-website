/**
 * Luv Experience Completion — celebration copy.
 *
 * Real Commitment Lifecycle transitions only (never drafts / navigation /
 * Mark complete ack). Each fires exactly once per client via
 * `luv_celebrations` unique (client_id, celebration_type).
 *
 * Types ship with couple-facing domain submits (guest count, timeline,
 * contract, website, vendor list, seating, questionnaire) plus coordinator
 * final-payment readiness. Message is a brief acknowledgement — not
 * gamification.
 */
export type CelebrationType =
  | "contract_signed"
  | "final_payment_received"
  | "guest_list_submitted"
  | "timeline_submitted"
  | "website_published"
  | "vendor_list_submitted"
  | "seating_submitted"
  | "questionnaire_submitted"
  | "insurance_uploaded"
  | "timeline_shared_with_vendor"
  | "final_payment_obligation_paid";

/** Couple-facing milestones — first person, warm, brief. */
export function coupleCelebrationMessage(
  type: Exclude<CelebrationType, "final_payment_received">,
): string {
  switch (type) {
    case "contract_signed":
      return "Your contract is signed. 🎉";
    case "guest_list_submitted":
      return "Your guest count is submitted. 🎉";
    case "timeline_submitted":
      return "Your timeline is submitted. 🎉";
    case "website_published":
      return "Your wedding website is live. 🎉";
    case "vendor_list_submitted":
      return "Your vendor list is with your venue. 🎉";
    case "seating_submitted":
      return "Your seating plan is submitted. 🎉";
    case "questionnaire_submitted":
      return "Your final details are in. 🎉";
    case "insurance_uploaded":
      return "Your event insurance is with your venue. 🎉";
    case "timeline_shared_with_vendor":
      return "Your timeline is shared with your vendor. 🎉";
    case "final_payment_obligation_paid":
      return "Your final payment is complete. 🎉";
  }
}

/** Coordinator view — third person, warm-analytical. */
export function coordinatorCelebrationMessage(type: CelebrationType, coupleName: string): string {
  switch (type) {
    case "contract_signed":
      return `${coupleName}'s contract is signed. 🎉`;
    case "final_payment_received":
      return `${coupleName}'s final payment is in. 🎉`;
    case "guest_list_submitted":
      return `${coupleName} submitted their guest count. 🎉`;
    case "timeline_submitted":
      return `${coupleName} submitted their timeline. 🎉`;
    case "website_published":
      return `${coupleName}'s wedding website is live. 🎉`;
    case "vendor_list_submitted":
      return `${coupleName} submitted their vendor list. 🎉`;
    case "seating_submitted":
      return `${coupleName} submitted their seating plan. 🎉`;
    case "questionnaire_submitted":
      return `${coupleName} submitted their final details. 🎉`;
    case "insurance_uploaded":
      return `${coupleName} shared their event insurance. 🎉`;
    case "timeline_shared_with_vendor":
      return `${coupleName} shared their timeline with a vendor. 🎉`;
    case "final_payment_obligation_paid":
      return `${coupleName}'s Final Payment obligation is paid. 🎉`;
  }
}
