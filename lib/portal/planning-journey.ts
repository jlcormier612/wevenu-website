/**
 * Couple Home — Wedding Journey presentation.
 *
 * Emotional / temporal arc only (Past · Now · Next). Uses the existing
 * date-based PlanningJourney milestones driven by `daysUntil`. No task
 * counts, no competing readiness %, no new tables/RPCs, no invented stages.
 */

export type JourneyStepState = "completed" | "current" | "upcoming" | "wedding_day";

export type PlanningJourneyMilestoneDef = {
  id: string;
  shortLabel: string;
  label: string;
  /** Days-until threshold used by the existing PlanningJourney path. */
  threshold: number;
};

/** Existing PlanningJourney countdown path (unchanged thresholds). */
export const PLANNING_JOURNEY_MILESTONES: readonly PlanningJourneyMilestoneDef[] = [
  { id: "12mo", shortLabel: "12 mo", label: "About a year out", threshold: 365 },
  { id: "9mo", shortLabel: "9 mo", label: "Nine months out", threshold: 270 },
  { id: "6mo", shortLabel: "6 mo", label: "Six months out", threshold: 180 },
  { id: "3mo", shortLabel: "3 mo", label: "Three months out", threshold: 90 },
  { id: "1mo", shortLabel: "1 mo", label: "About a month out", threshold: 30 },
  { id: "day", shortLabel: "Day", label: "Wedding day", threshold: 0 },
] as const;

export type PlanningJourneyStep = PlanningJourneyMilestoneDef & {
  state: JourneyStepState;
  /** Visible secondary label under the node (not color-only). */
  statusLabel: string;
};

export type PlanningJourneyUndated = {
  kind: "undated";
  narrative: string;
  accessibleSummary: string;
};

export type PlanningJourneyDated = {
  kind: "dated";
  steps: PlanningJourneyStep[];
  currentId: string;
  narrative: string;
  accessibleSummary: string;
  isWeddingDay: boolean;
};

export type PlanningJourneyModel = PlanningJourneyUndated | PlanningJourneyDated;

/**
 * Same current-index rule as Phase 1 PlanningJourney:
 * first milestone where daysUntil > threshold; if none, wedding day (last).
 */
export function planningJourneyCurrentIndex(daysUntil: number): number {
  const idx = PLANNING_JOURNEY_MILESTONES.findIndex((m) => daysUntil > m.threshold);
  return idx === -1 ? PLANNING_JOURNEY_MILESTONES.length - 1 : idx;
}

function statusLabelFor(state: JourneyStepState): string {
  switch (state) {
    case "completed":
      return "Done";
    case "current":
      return "You’re here";
    case "wedding_day":
      return "Wedding day";
    case "upcoming":
      return "Ahead";
  }
}

/**
 * Warm Past / Now / Next narrative — emotional, not operational.
 * Date-driven only; does not invent AI stages.
 */
export function planningJourneyNarrative(
  daysUntil: number,
  currentIndex: number,
): string {
  if (daysUntil === 0) {
    return "Today is your wedding day — the chapter you’ve been writing toward.";
  }
  if (daysUntil > 0 && daysUntil <= 14) {
    return "You’re in the final stretch — every moment closer to “I do.”";
  }
  if (currentIndex === 0) {
    return "Your story is just beginning — a whole season of planning ahead.";
  }
  if (currentIndex <= 2) {
    return "You’ve moved through the early months — you’re finding your rhythm.";
  }
  if (currentIndex <= 4) {
    return "The day is drawing nearer — you’re right where you should be.";
  }
  return "Almost there — wedding day is just ahead.";
}

export function resolvePlanningJourney(daysUntil: number | null): PlanningJourneyModel {
  if (daysUntil === null) {
    return {
      kind: "undated",
      narrative:
        "Your wedding date will guide this journey — a gentle path from now to “I do.”",
      accessibleSummary:
        "Wedding Journey. Your wedding date isn’t set yet, so the milestone path isn’t available.",
    };
  }

  // Post-wedding lives in Wedding Day / Keepsake bands — Journey stays planning-forward.
  if (daysUntil < 0) {
    return {
      kind: "undated",
      narrative: "Your wedding day has arrived and passed — this chapter is yours to keep.",
      accessibleSummary: "Wedding Journey. Your wedding day has passed.",
    };
  }

  const currentIndex = planningJourneyCurrentIndex(daysUntil);
  const isWeddingDay = daysUntil === 0;

  const steps: PlanningJourneyStep[] = PLANNING_JOURNEY_MILESTONES.map((m, i) => {
    let state: JourneyStepState;
    if (i < currentIndex) {
      state = "completed";
    } else if (i === currentIndex) {
      state = isWeddingDay && m.id === "day" ? "wedding_day" : "current";
    } else {
      state = "upcoming";
    }

    return {
      ...m,
      state,
      statusLabel: statusLabelFor(state),
    };
  });

  const current =
    steps.find((s) => s.state === "current" || s.state === "wedding_day") ??
    steps[steps.length - 1]!;
  const narrative = planningJourneyNarrative(daysUntil, currentIndex);
  const pastCount = steps.filter((s) => s.state === "completed").length;
  const aheadCount = steps.filter((s) => s.state === "upcoming").length;

  return {
    kind: "dated",
    steps,
    currentId: current.id,
    narrative,
    accessibleSummary:
      `Wedding Journey. You are at ${current.label}. ` +
      `${pastCount} milestone${pastCount === 1 ? "" : "s"} completed, ` +
      `${aheadCount} ahead. ${narrative}`,
    isWeddingDay,
  };
}
