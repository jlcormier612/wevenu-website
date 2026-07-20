/**
 * Website's own readiness/completeness status — mirrors the shape of
 * computeFloorPlansReadiness/computeGuestsReadiness in
 * lib/readiness/compute.ts (Luv Experience Completion, Work Stream 2).
 *
 * Replaces lib/luv/website-completeness-temporary.ts, which existed
 * specifically to isolate an ad hoc heuristic Luv had been computing
 * inline — this is that heuristic's real, feature-owned home. Same two
 * signals, same thresholds; only the ownership moved.
 */
import type { ReadinessSection, ReadinessStatus } from "@/lib/readiness/types";

export function computeWebsiteReadiness(params: {
  clientId: string;
  isPublished: boolean;
  hasTravelContent: boolean;
  daysUntilEvent: number;
}): ReadinessSection {
  const { clientId, isPublished, hasTravelContent, daysUntilEvent } = params;

  let status: ReadinessStatus;
  let detail: string;

  if (!isPublished && daysUntilEvent <= 120) {
    status = "needs_attention";
    detail = "Not published yet — couples typically publish 3-4 months out.";
  } else if (!isPublished) {
    status = "not_started";
    detail = "Not published yet.";
  } else if (!hasTravelContent && daysUntilEvent <= 120) {
    status = "waiting";
    detail = "Published — travel/accommodations info is still missing.";
  } else {
    status = "complete";
    detail = "Published.";
  }

  return {
    key: "website", label: "Wedding Website", status, detail,
    nav: { kind: "link", href: `/clients/${clientId}` },
  };
}
