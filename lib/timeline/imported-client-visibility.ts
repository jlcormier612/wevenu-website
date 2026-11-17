/**
 * Staff can see imported client Timeline rows without treating them as a
 * client submission or placing them on the shared Timeline.
 */
export type StaffImportedClientTimelineEntry = {
  id: string;
  title: string;
  entryTime: string | null;
  owner: "client";
  lockState: string;
};

export type ImportedClientTimelineCandidate = {
  id: string;
  owner: string;
  sourceSpaceUseKey: string | null;
  notes: string | null;
};

export function selectStaffVisibleImportedClientEntries<T extends ImportedClientTimelineCandidate>(
  rows: T[],
  submittedIds: ReadonlySet<string>,
): T[] {
  return rows.filter((row) =>
    row.owner === "client"
    && row.sourceSpaceUseKey == null
    && (row.notes ?? "").includes("[migration:")
    && !submittedIds.has(row.id)
  );
}

export function submittedTimelineIds(snapshot: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(snapshot)) return ids;
  for (const item of snapshot) {
    if (item && typeof item === "object" && "id" in item && item.id) ids.add(String(item.id));
  }
  return ids;
}
