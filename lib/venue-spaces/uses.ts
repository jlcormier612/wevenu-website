/**
 * Venue-configured physical-space uses.
 * Not hard-coded to wedding concepts — the venue chooses which uses appear.
 */

export type SpaceOperatingMode = "single" | "multi";

/** Suggested use keys venues may enable. Custom keys are also allowed. */
export const SUGGESTED_SPACE_USES = [
  { key: "ceremony", label: "Ceremony" },
  { key: "reception", label: "Reception" },
  { key: "cocktail_hour", label: "Cocktail Hour" },
  { key: "getting_ready", label: "Getting Ready" },
  { key: "rehearsal_dinner", label: "Rehearsal Dinner" },
  { key: "meeting", label: "Meeting" },
  { key: "conference", label: "Conference" },
  { key: "dining", label: "Dining" },
  { key: "other", label: "Other" },
] as const;

export function labelForUseKey(useKey: string, useLabel?: string | null): string {
  const trimmed = useLabel?.trim();
  if (trimmed) return trimmed;
  const suggested = SUGGESTED_SPACE_USES.find((u) => u.key === useKey);
  if (suggested) return suggested.label;
  if (useKey === "event_space") return "Event space";
  return useKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Human-facing event-space block for contracts / overview.
 * Single-space / no uses → "Event space: Barn" or just space name.
 * Multi-use assignments → "Ceremony: Garden\nReception: Barn"
 */
export function formatEventSpaceAssignmentsDisplay(
  assignments: Array<{ useKey: string; useLabel: string; spaceName: string }>,
): string | null {
  if (assignments.length === 0) return null;
  // Prefer venue-configured uses over legacy single "event_space" backfill rows
  // when both exist (e.g. after a partial replace).
  const configured = assignments.filter((a) => a.useKey !== "event_space");
  const rows = configured.length > 0 ? configured : assignments;
  if (rows.length === 1 && rows[0]!.useKey === "event_space") {
    return rows[0]!.spaceName;
  }
  if (rows.length === 1) {
    const a = rows[0]!;
    return `${labelForUseKey(a.useKey, a.useLabel)}: ${a.spaceName}`;
  }
  return rows
    .map((a) => `${labelForUseKey(a.useKey, a.useLabel)}: ${a.spaceName}`)
    .join("\n");
}

/** Calendar space filter only when venue opted into multi-space operations. */
export function shouldShowCalendarSpaceFilter(mode: SpaceOperatingMode | null | undefined): boolean {
  return mode === "multi";
}
