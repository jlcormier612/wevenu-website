/**
 * TEMPORARY DEPENDENCY — Platform Intelligence Adoption, Phase 1.
 *
 * Website does not yet expose its own completeness/status concept (per
 * docs/luv-platform-reconciliation.md §2 and §7 of
 * docs/luv-platform-intelligence-architecture.md's Feature Completion
 * Contract). Luv previously computed this ad hoc, inline, inside
 * lib/luv/observations.ts — exactly the "no capability should create
 * separate readiness logic" anti-pattern Event Readiness's own Guiding
 * Philosophy forbids, just already present in Luv's own code rather than
 * a new instance.
 *
 * This file does not fix that — it isolates it, so the dependency is
 * impossible to miss and trivial to delete. The moment Website exposes a
 * real, feature-owned status function (mirroring the shape of
 * computeFloorPlansReadiness or computeGuestsReadiness in
 * lib/readiness/compute.ts), this entire file should be deleted and
 * lib/luv/observations.ts should read that function's output instead —
 * do not extend the logic below in the meantime, and do not add new
 * completeness conditions here. Any new Website signal belongs on
 * Website's own service, not here.
 */

export type WebsiteCompletenessGap =
  | { kind: "unpublished"; daysUntilEvent: number }
  | { kind: "missing_travel_info" }
  | null;

export function computeWebsiteCompletenessGapTemporary(params: {
  isPublished: boolean;
  hasTravelContent: boolean;
  daysUntilEvent: number;
}): WebsiteCompletenessGap {
  if (!params.isPublished && params.daysUntilEvent <= 120) {
    return { kind: "unpublished", daysUntilEvent: params.daysUntilEvent };
  }
  if (params.isPublished && !params.hasTravelContent && params.daysUntilEvent <= 120) {
    return { kind: "missing_travel_info" };
  }
  return null;
}
