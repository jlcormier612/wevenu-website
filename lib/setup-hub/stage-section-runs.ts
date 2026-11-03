/**
 * Phase 9 — Setup Hub eucalyptus section runs.
 * Groups stages into contiguous completion runs without reordering.
 * Headings reuse Setup Readiness terminology and never imply ready_to_invite_couples.
 */

export type SetupStageCompletionStatus =
  | "complete"
  | "in_progress"
  | "not_started"
  | null;

export type SetupStageSectionBucket = "complete" | "incomplete";

export const SETUP_STAGE_SECTION_HEADING = {
  complete: "All set",
  incomplete: "Still needs your attention",
} as const;

export function setupStageSectionBucket(
  status: SetupStageCompletionStatus,
): SetupStageSectionBucket {
  return status === "complete" ? "complete" : "incomplete";
}

export function contiguousSetupStageRuns<T extends { status: SetupStageCompletionStatus }>(
  stages: readonly T[],
): Array<{
  bucket: SetupStageSectionBucket;
  heading: (typeof SETUP_STAGE_SECTION_HEADING)[SetupStageSectionBucket];
  stages: T[];
}> {
  const runs: Array<{
    bucket: SetupStageSectionBucket;
    heading: (typeof SETUP_STAGE_SECTION_HEADING)[SetupStageSectionBucket];
    stages: T[];
  }> = [];

  for (const stage of stages) {
    const bucket = setupStageSectionBucket(stage.status);
    const last = runs[runs.length - 1];
    if (last && last.bucket === bucket) {
      last.stages.push(stage);
    } else {
      runs.push({
        bucket,
        heading: SETUP_STAGE_SECTION_HEADING[bucket],
        stages: [stage],
      });
    }
  }

  return runs;
}
