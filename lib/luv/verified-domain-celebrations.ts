/**
 * Couple Tasks Impl 4 — which verified domain commits own a one-time Luv
 * celebration. Celebration is layered acknowledgment only; it does not
 * complete tasks.
 *
 * Rule: ONLY CELEBRATE WHAT THE SYSTEM CAN PROVE.
 */
import type { CelebrationType } from "@/lib/luv/celebrations";

/** Playbook `auto_complete_trigger` values that map to a couple celebration. */
export type VerifiedCelebrationTrigger =
  | "guest_count_finalized"
  | "vendor_selected"
  | "seating_submitted"
  | "timeline_submitted"
  | "contract_signed"
  | "questionnaire_submitted"
  | "document_uploaded_insurance";

/**
 * Triggers intentionally NOT celebrated here (unsafe / unsupported):
 * - payment_received — any paid line; too broad (final_payment_received is separate)
 * - null / Mark complete ack / Leave a review / package
 * - share_timeline playbook-style trigger string — vendor share uses dedicated
 *   celebration type timeline_shared_with_vendor from the share RPC (Impl 6),
 *   not this playbook-trigger map
 *
 * document_uploaded_insurance is celebrated only after the couple path proves
 * classified + shared insurance (Impl 5) — not on venue/vendor docs alone.
 */
const TRIGGER_TO_CELEBRATION: Record<VerifiedCelebrationTrigger, CelebrationType> = {
  guest_count_finalized: "guest_list_submitted",
  vendor_selected: "vendor_list_submitted",
  seating_submitted: "seating_submitted",
  timeline_submitted: "timeline_submitted",
  contract_signed: "contract_signed",
  questionnaire_submitted: "questionnaire_submitted",
  document_uploaded_insurance: "insurance_uploaded",
};

export function celebrationTypeForVerifiedTrigger(
  trigger: string | null | undefined,
): CelebrationType | null {
  if (!trigger) return null;
  if (!(trigger in TRIGGER_TO_CELEBRATION)) return null;
  return TRIGGER_TO_CELEBRATION[trigger as VerifiedCelebrationTrigger];
}

/** UI may call celebrateLuv only when the durable insert returned celebrated. */
export function shouldPresentVerifiedCelebration(celebratedFlag: boolean | null | undefined): boolean {
  return celebratedFlag === true;
}

/** Manual Mark complete confetti must not double-fire with verified Luv. */
export function mayCelebrateManualTaskComplete(opts: {
  hasAutoCompleteTrigger: boolean;
}): boolean {
  // Impl 1 blocks portal Mark complete when a trigger is set; defense in depth.
  return !opts.hasAutoCompleteTrigger;
}
