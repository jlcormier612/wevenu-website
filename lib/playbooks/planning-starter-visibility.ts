/**
 * Which Hello to Cheers starter example cards to show on the Planning
 * Templates library page. Once a venue has instantiated the corresponding
 * master template, the large starter card is hidden so the Library row is
 * the sole prominent representation.
 */

export type PlanningStarterMasterKey = "PB-CLIENT-01" | "PB-VENUE-01";

export function visiblePlanningStarterKinds(
  templates: ReadonlyArray<{ sourceMasterKey: string | null }>,
): { showClient: boolean; showVenue: boolean } {
  const hasClientMaster = templates.some((t) => t.sourceMasterKey === "PB-CLIENT-01");
  const hasVenueMaster = templates.some((t) => t.sourceMasterKey === "PB-VENUE-01");
  return {
    showClient: !hasClientMaster,
    showVenue: !hasVenueMaster,
  };
}

export function isStandardPlanningMasterKey(
  key: string | null | undefined,
): key is PlanningStarterMasterKey {
  return key === "PB-CLIENT-01" || key === "PB-VENUE-01";
}
