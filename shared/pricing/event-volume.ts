/**
 * Pure event-volume evaluator for SaaS tier recommendations.
 *
 * Rules:
 * - Count by calendar year of `eventDate` (venue civil date), not bookedAt year.
 * - Qualifying: status in confirmed | in_progress | complete AND bookedAt set.
 * - Cancelled excluded even if bookedAt remains.
 * - Each event counted once (start-date year for multi-day).
 * - Recommended tier uses the peak year count across all years.
 * - Does not mutate or schedule Stripe changes (Phase 3).
 */

import type { SaasPlanKey } from "./types";

export type EventVolumeStatus =
  | "draft"
  | "confirmed"
  | "in_progress"
  | "complete"
  | "cancelled";

export type EventVolumeInputEvent = {
  id: string;
  status: EventVolumeStatus | string;
  /** ISO civil date YYYY-MM-DD (venue event start date) */
  eventDate: string;
  /** Booking commitment stamp; null/undefined = not a qualifying booked event */
  bookedAt: string | null | undefined;
};

export type EventVolumeEvaluation = {
  byYear: Record<number, number>;
  peakYear: number | null;
  peakCount: number;
  recommendedPlan: SaasPlanKey;
  explanation: string;
};

const QUALIFYING = new Set(["confirmed", "in_progress", "complete"]);

export function isQualifyingVolumeEvent(event: EventVolumeInputEvent): boolean {
  if (!QUALIFYING.has(event.status)) return false;
  if (event.bookedAt == null || String(event.bookedAt).trim() === "") {
    return false;
  }
  return true;
}

/** Extract calendar year from YYYY-MM-DD (or ISO datetime prefix). */
export function calendarYearFromEventDate(eventDate: string): number | null {
  const match = /^(\d{4})-/.exec(eventDate.trim());
  if (!match) return null;
  const year = Number.parseInt(match[1]!, 10);
  return Number.isFinite(year) ? year : null;
}

export function planForPeakCount(peakCount: number): SaasPlanKey {
  if (peakCount >= 76) return "professional";
  if (peakCount >= 26) return "growing";
  return "starter";
}

export function evaluateEventVolume(input: {
  events: EventVolumeInputEvent[];
  /** Reserved for future as-of filtering; unused in Phase 1A. */
  asOfDate?: string;
}): EventVolumeEvaluation {
  const byYear: Record<number, number> = {};

  for (const event of input.events) {
    if (!isQualifyingVolumeEvent(event)) continue;
    const year = calendarYearFromEventDate(event.eventDate);
    if (year == null) continue;
    byYear[year] = (byYear[year] ?? 0) + 1;
  }

  let peakYear: number | null = null;
  let peakCount = 0;
  for (const [yearText, count] of Object.entries(byYear)) {
    const year = Number.parseInt(yearText, 10);
    if (count > peakCount || (count === peakCount && (peakYear == null || year > peakYear))) {
      peakCount = count;
      peakYear = year;
    }
  }

  const recommendedPlan = planForPeakCount(peakCount);
  const explanation =
    peakYear == null
      ? "No qualifying booked events; recommended Gather (0–25)."
      : `Peak ${peakCount} qualifying event(s) in ${peakYear}; recommended ${recommendedPlan}.`;

  return {
    byYear,
    peakYear,
    peakCount,
    recommendedPlan,
    explanation,
  };
}

/**
 * Whether an automatic upgrade should be considered later (Phase 3).
 * Phase 1A never schedules changes; this helper documents the comparison only.
 */
export function recommendedUpgrade(input: {
  currentPlan: SaasPlanKey;
  recommendedPlan: SaasPlanKey;
}): SaasPlanKey | null {
  const order: SaasPlanKey[] = ["starter", "growing", "professional"];
  const currentIdx = order.indexOf(input.currentPlan);
  const recommendedIdx = order.indexOf(input.recommendedPlan);
  if (recommendedIdx > currentIdx) return input.recommendedPlan;
  return null;
}
