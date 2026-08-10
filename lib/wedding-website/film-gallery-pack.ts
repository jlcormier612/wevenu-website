/**
 * Film Photo Style contact-sheet packing (Gallery Option D, Film variant).
 *
 * Film's cream strip body shows through empty CSS-grid tracks — Midnight's
 * dark field hid the same orphan. Prefer 3- then 2-column sheets (classic
 * contact), then render each row as its own grid whose column count equals
 * that row's photo count and is centered when shorter than a full sheet row.
 */

export const FILM_CONTACT_COL_CANDIDATES = [3, 2] as const;

/**
 * Choose contact-sheet column count for `count` photos.
 * Prefers an exact divisor from {3,2} (fuller first), then fewer rows /
 * smaller last-row remainder.
 */
export function pickFilmContactColumns(count: number): number {
  if (count <= 0) return 1;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;

  for (const cols of FILM_CONTACT_COL_CANDIDATES) {
    if (count % cols === 0) return cols;
  }

  let best = 3;
  let bestRows = Number.POSITIVE_INFINITY;
  let bestRem = Number.POSITIVE_INFINITY;

  for (const cols of FILM_CONTACT_COL_CANDIDATES) {
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

/** Chunk photos into sheet rows of at most `cols`. */
export function chunkFilmContactRows<T>(items: T[], cols: number): T[][] {
  if (cols <= 0) return items.length ? [items] : [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

/**
 * Width of a short final row as a fraction of the full sheet (so orphan
 * cells don't leave empty cream tracks beside them).
 */
export function filmContactRowWidthPercent(rowLen: number, cols: number): number {
  if (cols <= 0 || rowLen <= 0) return 100;
  if (rowLen >= cols) return 100;
  return Math.round((rowLen / cols) * 10000) / 100;
}
