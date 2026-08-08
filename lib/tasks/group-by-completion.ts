/**
 * Shared open / completed partitioning for task lists across venue,
 * vendor, and couple surfaces. Completed items leave the open list and
 * render under a separate "Completed" section; due-date order is
 * preserved within each group.
 */

/** Due dates ascending; null/undefined due dates sort last. */
export function compareDueDatesAsc(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

export function sortByDueDateAsc<T>(
  items: readonly T[],
  getDueDate: (item: T) => string | null | undefined,
): T[] {
  return [...items].sort((a, b) => compareDueDatesAsc(getDueDate(a), getDueDate(b)));
}

/**
 * Split into open (incomplete) then completed. When `getDueDate` is
 * provided, each group is sorted by due date ascending (undated last).
 * Callers should hide the Completed section when `completed.length === 0`.
 */
export function partitionByCompletion<T>(
  items: readonly T[],
  opts: {
    isComplete: (item: T) => boolean;
    getDueDate?: (item: T) => string | null | undefined;
  },
): { open: T[]; completed: T[] } {
  const { isComplete, getDueDate } = opts;
  const open: T[] = [];
  const completed: T[] = [];
  for (const item of items) {
    if (isComplete(item)) completed.push(item);
    else open.push(item);
  }
  if (getDueDate) {
    open.sort((a, b) => compareDueDatesAsc(getDueDate(a), getDueDate(b)));
    completed.sort((a, b) => compareDueDatesAsc(getDueDate(a), getDueDate(b)));
  }
  return { open, completed };
}
