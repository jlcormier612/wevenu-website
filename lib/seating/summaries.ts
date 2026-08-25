import type { SeatingFloorPlanSummary } from "@/lib/portal/types";

export type VenueSeatingDelegationRow = { floor_plan_id: string; revoked_at: string | null };
export type VenueSeatingSubmissionRow = {
  floor_plan_id: string;
  guest_count: number;
  submitted_by: "couple" | "venue";
  created_at: string;
};

export function buildVenueSeatingFloorPlanSummaries(
  floorPlans: { id: string; name: string }[],
  delegations: VenueSeatingDelegationRow[],
  submissions: VenueSeatingSubmissionRow[],
): SeatingFloorPlanSummary[] {
  const activeDelegationIds = new Set(
    delegations.filter((delegation) => !delegation.revoked_at).map((delegation) => delegation.floor_plan_id),
  );
  const latestSubmissionByPlan = new Map<string, VenueSeatingSubmissionRow>();
  for (const submission of submissions) {
    if (!latestSubmissionByPlan.has(submission.floor_plan_id)) {
      latestSubmissionByPlan.set(submission.floor_plan_id, submission);
    }
  }

  return floorPlans.map((floorPlan) => {
    const submission = latestSubmissionByPlan.get(floorPlan.id);
    return {
      id: floorPlan.id,
      name: floorPlan.name,
      isDelegated: activeDelegationIds.has(floorPlan.id),
      lastSubmission: submission
        ? {
            count: submission.guest_count,
            submittedAt: submission.created_at,
            submittedBy: submission.submitted_by,
          }
        : null,
    };
  });
}
