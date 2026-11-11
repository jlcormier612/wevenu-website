/**
 * Venue highlights UI: group by couple-submitted selectedAt only.
 * pickedAt is private to the couple and must never drive these groups.
 */

export function partitionRecommendationsByCoupleSubmission<
  T extends { selectedAt: string | null },
>(rows: readonly T[]): { chosen: T[]; notYetSubmitted: T[] } {
  const chosen: T[] = [];
  const notYetSubmitted: T[] = [];
  for (const row of rows) {
    if (row.selectedAt) chosen.push(row);
    else notYetSubmitted.push(row);
  }
  return { chosen, notYetSubmitted };
}
