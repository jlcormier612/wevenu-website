/**
 * Split Library items into active vs archived without a second archive system.
 * Domains keep their own is_archived / is_active fields; this is presentation only.
 */

export function partitionArchived<T>(
  items: T[],
  isArchived: (item: T) => boolean,
): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];
  for (const item of items) {
    if (isArchived(item)) archived.push(item);
    else active.push(item);
  }
  return { active, archived };
}
