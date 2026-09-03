/**
 * Booking.Confirmed no longer silently applies default Planning Templates.
 *
 * Phase 2 replaced that guarantee with explicit Recommend → Review → Apply
 * on /clients/[id]/booked. Venue-configurable Automation Rules (including
 * apply_planning_template) are unchanged — only this unconditional path
 * is a no-op.
 *
 * Kept exported so the automation sweep result shape
 * (`systemGuarantees: { applied, skipped, failed }`) stays stable.
 */
export type SystemGuaranteeResult = { applied: number; skipped: number; failed: number };

export async function applyDefaultPlaybooksForConfirmedBookings(): Promise<SystemGuaranteeResult> {
  return { applied: 0, skipped: 0, failed: 0 };
}
