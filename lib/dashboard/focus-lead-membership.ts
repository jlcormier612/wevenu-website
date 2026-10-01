/**
 * Dashboard Focus lead membership — locked product rules.
 *
 * Include:
 * - open-lifecycle + overdue follow-up
 * - open-lifecycle + follow-up due today
 * - open-lifecycle new_inquiry older than 48h with no follow-up
 * - non-completed tours from today through today + 14 days
 *
 * Exclude: terminal leads. No arbitrary LIMIT.
 */
import { isOpenLeadLifecycle } from "@/lib/leads/open-lifecycle";

export function leadMatchesFocusFollowUpRules(
  lead: {
    salesStage?: string | null;
    status?: string | null;
    followUpDate?: string | null;
    createdAt: string;
  },
  today: string,
  twoDaysAgoMs: number,
): boolean {
  const stage = lead.salesStage ?? lead.status;
  if (!isOpenLeadLifecycle(stage)) return false;
  if (lead.followUpDate && lead.followUpDate < today) return true;
  if (lead.followUpDate === today) return true;
  if (
    stage === "new_inquiry" &&
    !lead.followUpDate &&
    new Date(lead.createdAt).getTime() < twoDaysAgoMs
  ) {
    return true;
  }
  return false;
}

export function leadMatchesFocusTourRules(
  tour: { tourDate: string | null; tourCompleted: boolean },
  today: string,
  twoWeeksOut: string,
): boolean {
  return Boolean(
    tour.tourDate &&
      tour.tourDate >= today &&
      tour.tourDate <= twoWeeksOut &&
      !tour.tourCompleted,
  );
}

/** Whether a lead belongs in the Focus-authoritative load set. */
export function leadBelongsInFocusPopulation(
  lead: {
    salesStage?: string | null;
    status?: string | null;
    followUpDate?: string | null;
    createdAt: string;
    tourDate: string | null;
    tourCompleted: boolean;
  },
  today: string,
  twoDaysAgoMs: number,
  twoWeeksOut: string,
): boolean {
  // Locked Phase 3A: terminal leads are excluded from Focus entirely.
  if (!isOpenLeadLifecycle(lead.salesStage ?? lead.status)) return false;
  if (leadMatchesFocusFollowUpRules(lead, today, twoDaysAgoMs)) return true;
  return leadMatchesFocusTourRules(lead, today, twoWeeksOut);
}
