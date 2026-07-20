/**
 * Luv Experience Completion, Work Stream 3 — celebration copy.
 *
 * Exactly the 5 milestones approved: each is a real Commitment Lifecycle
 * transition (never an arbitrary action — no "edited timeline," no "added
 * guest"), each fires exactly once per client (enforced in the database,
 * see supabase/migrations/20261102000000_luv_celebrations.sql), and the
 * message is a brief acknowledgement, not an achievement screen.
 *
 * "Luv shouldn't ask questions when she already knows the answer" governs
 * every string below — these are statements of what just became true, not
 * prompts.
 */
export type CelebrationType =
  | "contract_signed"
  | "final_payment_received"
  | "guest_list_submitted"
  | "timeline_submitted"
  | "website_published";

/** The couple's own 4 self-triggered milestones — first person, warm, brief. */
export function coupleCelebrationMessage(type: Exclude<CelebrationType, "final_payment_received">): string {
  switch (type) {
    case "contract_signed": return "Your contract is signed. 🎉";
    case "guest_list_submitted": return "Your guest count is submitted. 🎉";
    case "timeline_submitted": return "Your timeline is submitted. 🎉";
    case "website_published": return "Your wedding website is live. 🎉";
  }
}

/** The coordinator's own view of the same milestones — third person, warm-analytical. */
export function coordinatorCelebrationMessage(type: CelebrationType, coupleName: string): string {
  switch (type) {
    case "contract_signed": return `${coupleName}'s contract is signed. 🎉`;
    case "final_payment_received": return `${coupleName}'s final payment is in. 🎉`;
    case "guest_list_submitted": return `${coupleName} submitted their guest count. 🎉`;
    case "timeline_submitted": return `${coupleName} submitted their timeline. 🎉`;
    case "website_published": return `${coupleName}'s wedding website is live. 🎉`;
  }
}
