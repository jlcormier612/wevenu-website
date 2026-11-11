import type { PersistedTimelineDraft } from "@/lib/timeline/types";

export type SavedDraftRow = {
  id: string;
  dayOffset: number;
  entryTime: string;
  isNew: boolean;
  dirty: boolean;
  pendingRemove: boolean;
};

/**
 * After Save all, show the day and clock that were written.
 * A fixed or wedding-end day the server kept is not left on screen as the saved value.
 */
export function reconcileSavedDraftRows<T extends SavedDraftRow>(
  rows: T[],
  result: { createdIds: string[]; persisted: PersistedTimelineDraft[] },
): T[] {
  const persistedById = new Map(result.persisted.map((row) => [row.id, row]));
  let createdIdx = 0;
  return rows
    .filter((row) => !row.pendingRemove)
    .map((row) => {
      if (row.isNew) {
        const realId = result.createdIds[createdIdx++] ?? row.id;
        const persisted = persistedById.get(realId);
        return {
          ...row,
          id: realId,
          isNew: false,
          dirty: false,
          pendingRemove: false,
          dayOffset: persisted?.dayOffset ?? row.dayOffset,
          entryTime: persisted ? (persisted.entryTime ?? "") : row.entryTime,
        };
      }
      const persisted = persistedById.get(row.id);
      if (!persisted) {
        return { ...row, dirty: false, pendingRemove: false };
      }
      return {
        ...row,
        dirty: false,
        pendingRemove: false,
        dayOffset: persisted.dayOffset,
        entryTime: persisted.entryTime ?? "",
      };
    });
}
