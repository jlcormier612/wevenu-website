/**
 * Lead status <-> canonical Pipeline Stage mapping — Phase 2 compatibility
 * layer (docs/booking-journey-design.md §1-2). Pure functions, no DB/framework
 * imports, so both server pages and (if ever needed) client components can
 * use them without pulling in server-only code.
 *
 * leads.status remains the single enforced source of truth everywhere else
 * in the app (analytics, Automated Series, scoring, activity trigger). This
 * mapping exists only to (a) decide which Pipeline Stage to *display* for a
 * lead that has never had one explicitly set, and (b) decide which
 * leads.status value to write when a coordinator picks a Pipeline Stage.
 */
import type { LeadStatus } from "@/lib/leads/types";
import type { CanonicalStage } from "@/lib/pipeline-templates/types";

/** status -> canonical stage, for display when no stage has been explicitly chosen yet. */
export const LEAD_STATUS_TO_CANONICAL_STAGE: Record<LeadStatus, CanonicalStage> = {
  new: "inquiry",
  // docs/booking-journey-design.md §1: "Contacted and qualified collapse
  // into the tour stages" — a venue doesn't think "qualified," they think
  // "did we show them the space yet." Not a new decision, restating the
  // one already on record.
  contacted: "tour",
  qualified: "tour",
  proposal_sent: "proposal",
  won: "booked",
  lost: "lost",
  cancelled: "cancelled",
};

/**
 * canonical stage -> status, for writing leads.status when a coordinator
 * picks a Pipeline Stage. "decision" has no equivalent in the current
 * 7-value status vocabulary at all — docs/booking-journey-design.md names
 * this exact gap ("Decision Pending... currently invisible") and proposes
 * it as new infrastructure, not something this phase builds. Approximated
 * here as proposal_sent (the closest existing non-terminal status) so the
 * picker never fails outright — flagged plainly, not a real answer.
 */
export const CANONICAL_STAGE_TO_LEAD_STATUS: Record<CanonicalStage, LeadStatus> = {
  inquiry: "new",
  tour: "contacted",
  proposal: "proposal_sent",
  decision: "proposal_sent", // approximation — see comment above
  booked: "won",
  lost: "lost",
  cancelled: "cancelled",
};

/**
 * Which Pipeline Stage should display for this lead right now.
 * Explicit choice (pipeline_stage_id) wins when it's still a real stage in
 * the given list; otherwise falls back to the first stage (by sort order)
 * whose canonical mapping matches the lead's real status.
 */
export function resolvePipelineStageForLead<T extends { id: string; canonicalStage: CanonicalStage; sortOrder: number }>(
  status: LeadStatus,
  explicitStageId: string | null,
  stages: T[],
): T | null {
  if (explicitStageId) {
    const explicit = stages.find((s) => s.id === explicitStageId);
    if (explicit) return explicit;
  }
  const canonical = LEAD_STATUS_TO_CANONICAL_STAGE[status];
  const matches = stages.filter((s) => s.canonicalStage === canonical).sort((a, b) => a.sortOrder - b.sortOrder);
  return matches[0] ?? null;
}
