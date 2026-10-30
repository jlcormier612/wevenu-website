/**
 * Narrow B headcount helpers.
 *
 * B0: storage + UI only. Event Order apply/seed still uses Estimated (`guest_count`).
 * Do not wire `boundHeadcountForApply` into EO paths until slice B1.
 */

/** Recalc of open EO lines when a bound headcount changes — off through B1. */
export function headcountRecalcEnabled(): boolean {
  return false;
}

/** Estimated = today's `events.guest_count` (no rename in B0). */
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
 * Bound count for later apply/seed (B1+): Guaranteed if set, else Estimated.
 * B0 callers must not use this for Event Order apply yet.
 */
export function boundHeadcountForApply(
  estimated: number | null | undefined,
  guaranteed: number | null | undefined,
): number | null {
  return guaranteedHeadcount(guaranteed) ?? estimatedHeadcount(estimated);
}
