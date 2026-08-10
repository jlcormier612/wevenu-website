/**
 * Midnight Photo Style support-fleet packing (Gallery Option D).
 *
 * Wide cinematic lead stays outside this helper. Support tiles sit on the
 * dark field in a 2–4 column grid: prefer an exact divisor of the support
 * count (fuller first → fewer rows), then fall back for awkward counts.
 * Incomplete last rows center (tiny rem=1 may span 2).
 */

/** Allowed support column counts — never 5 (orphan last-row bar). */
export const MIDNIGHT_SUPPORT_COL_CANDIDATES = [4, 3, 2] as const;

/**
 * Choose column count for `count` Midnight support photos.
 * Prefers a divisor from {4,3,2} (fuller first). Fallback: fewer rows,
 * then smaller last-row remainder, then fuller columns.
 */
export function pickMidnightSupportColumns(count: number): number {
  if (count <= 0) return 1;
  if (count === 1) return 1;
  if (count <= 4) return count;

  for (const cols of MIDNIGHT_SUPPORT_COL_CANDIDATES) {
    if (count % cols === 0) return cols;
  }

  let best = 4;
  let bestRows = Number.POSITIVE_INFINITY;
  let bestRem = Number.POSITIVE_INFINITY;

  for (const cols of MIDNIGHT_SUPPORT_COL_CANDIDATES) {
    const rows = Math.ceil(count / cols);
    const rem = count % cols;
    if (
      rows < bestRows ||
      (rows === bestRows && rem < bestRem) ||
      (rows === bestRows && rem === bestRem && cols > best)
    ) {
      best = cols;
      bestRows = rows;
      bestRem = rem;
    }
  }
  return best;
}

/**
 * CSS `grid-column` for one support cell so an incomplete last row
 * centers (and a lone remainder spans 2 when the grid is wide enough).
 */
export function midnightSupportGridColumn(
  index: number,
  count: number,
  cols: number,
): string | undefined {
  if (cols <= 1 || count <= 0) return undefined;
  const rem = count % cols;
  if (rem === 0) return undefined;
  const lastRowStart = count - rem;
  if (index < lastRowStart) return undefined;

  const posInLast = index - lastRowStart;
  // Tiny single orphan: span 2 centered when there is room.
  if (rem === 1 && cols >= 3) {
    const span = Math.min(2, cols);
    const start = Math.floor((cols - span) / 2) + 1;
    return `${start} / span ${span}`;
  }

  const start = Math.floor((cols - rem) / 2) + 1;
  return String(start + posInLast);
}
