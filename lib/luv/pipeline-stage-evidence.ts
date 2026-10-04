/**
 * LOCKED Luv rule: pipeline / sales stage is never authoritative evidence.
 *
 * Stage may be weak contextual metadata ("this relationship may be around
 * this part of the journey"). It must never prove that an action occurred
 * or that a customer is currently in that state.
 *
 * Applies to coordinator observations AND customer-facing drafts.
 */

export const PIPELINE_STAGE_IS_NOT_EVIDENCE =
  "Pipeline / sales stage is never authoritative proof that an action occurred.";

export type AuthoritativeTourStatus = "scheduled" | "confirmed" | "completed" | "no_show" | "cancelled" | string;

export function isAuthoritativeBooked(facts: {
  firstBookedAt?: string | null;
}): boolean {
  return Boolean(facts.firstBookedAt);
}

export function isAuthoritativeLost(facts: {
  lostAt?: string | null;
}): boolean {
  return Boolean(facts.lostAt);
}

export function isAuthoritativeTourScheduled(tour: {
  status?: string | null;
} | null | undefined): boolean {
  if (!tour?.status) return false;
  return tour.status === "scheduled" || tour.status === "confirmed";
}

/**
 * P-A1 first-response contact via a tour appointment.
 * Distinct from isAuthoritativeTourScheduled (upcoming occupancy only).
 * Completed, cancelled, no-show, and walk-in completed all mean the venue
 * already met / scheduled with them — not an unattended inquiry.
 */
export const UNATTENDED_INQUIRY_TOUR_CONTACT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export function isAuthoritativeTourContactForUnattendedInquiry(tour: {
  status?: string | null;
  origin?: string | null;
} | null | undefined): boolean {
  if (!tour) return false;
  if (tour.origin === "walk_in") return true;
  if (!tour.status) return false;
  return (UNATTENDED_INQUIRY_TOUR_CONTACT_STATUSES as readonly string[]).includes(
    tour.status,
  );
}

export function isAuthoritativeTourConfirmed(tour: {
  status?: string | null;
} | null | undefined): boolean {
  return tour?.status === "confirmed";
}

/** Proposal sent: commercial_proposals.status = sent AND offered_at IS NOT NULL. */
export function isAuthoritativeProposalSentRecord(row: {
  status?: string | null;
  offeredAt?: string | null;
} | null | undefined): boolean {
  if (!row) return false;
  return row.status === "sent" && Boolean(row.offeredAt);
}

export function isAuthoritativeContractSigned(row: {
  status?: string | null;
  clientSigned?: boolean;
} | null | undefined): boolean {
  if (!row) return false;
  return row.status === "signed" || row.clientSigned === true;
}

export function isAuthoritativePaymentReceived(row: {
  linePaid?: boolean;
} | null | undefined): boolean {
  return Boolean(row?.linePaid);
}

/**
 * Stage strings must not be used to claim a completed action.
 * Tests lock this by scanning observation/draft copy builders.
 */
export function stageCannotProve(action: string): string {
  return `${PIPELINE_STAGE_IS_NOT_EVIDENCE} Do not infer ${action} from sales_stage.`;
}
