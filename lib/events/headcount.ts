/**
 * Narrow B headcount helpers.
 *
 * B1: new Event Order apply/seed uses `boundHeadcountForApply` (Guaranteed ?? Estimated).
 * Recalc of existing lines stays off until B2 (`headcountRecalcEnabled`).
 */

/** Recalc of open EO lines when a bound headcount changes — off through B1. */
export function headcountRecalcEnabled(): boolean {
  return false;
}

/** Estimated = today's `events.guest_count` (no rename). */
export function estimatedHeadcount(guestCount: number | null | undefined): number | null {
  if (guestCount == null || !Number.isFinite(guestCount)) return null;
  const n = Math.trunc(guestCount);
  return n >= 0 ? n : null;
}

/** Optional Guaranteed column. */
export function guaranteedHeadcount(
  guaranteedGuestCount: number | null | undefined,
): number | null {
  if (guaranteedGuestCount == null || !Number.isFinite(guaranteedGuestCount)) return null;
  const n = Math.trunc(guaranteedGuestCount);
  return n >= 0 ? n : null;
}

/**
 * Bound count for new apply/seed (B1+): Guaranteed if set, else Estimated.
 * Do not use this to rewrite existing EO line quantities until B2.
 */
export function boundHeadcountForApply(
  estimated: number | null | undefined,
  guaranteed: number | null | undefined,
): number | null {
  return guaranteedHeadcount(guaranteed) ?? estimatedHeadcount(estimated);
}
