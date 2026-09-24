/**
 * Calendar space filter — a separate dimension from Event/Tour/Appointment/Hold/Blocked Time.
 * Uses canonical event space assignment + events.space_id. Does not invent a second model.
 */

import type { CalendarItem } from "@/lib/calendar/types";

export type CalendarSpaceOption = { id: string; name: string };

/** Space ids associated with a calendar item (assignments first, then primary spaceId). */
export function spaceIdsForCalendarItem(
  item: Pick<CalendarItem, "spaceId" | "spaceIds">,
): string[] {
  if (item.spaceIds && item.spaceIds.length > 0) {
    return [...new Set(item.spaceIds.filter((id): id is string => Boolean(id)))];
  }
  return item.spaceId ? [item.spaceId] : [];
}

/** Former “No space set” sentinel — not a physical space; treat as All spaces. */
export const CALENDAR_UNASSIGNED_SPACE = "__unassigned__";

/** All spaces (null / leftover unassigned sentinel) — no physical-space restriction. */
export function normalizeCalendarSpaceFilterId(spaceId: string | null): string | null {
  if (!spaceId || spaceId === CALENDAR_UNASSIGNED_SPACE) return null;
  return spaceId;
}

/**
 * All spaces (null) → every item, including items with no space assignment.
 * A configured space → items associated with that space only.
 * Unassigned items are never attributed to a named space.
 */
export function calendarItemMatchesSpace(
  item: Pick<CalendarItem, "spaceId" | "spaceIds">,
  selectedSpaceId: string | null,
): boolean {
  const selected = normalizeCalendarSpaceFilterId(selectedSpaceId);
  if (!selected) return true;
  const ids = spaceIdsForCalendarItem(item);
  return ids.includes(selected);
}

export function calendarSpaceOptionsFromVenueSpaces(
  spaces: Array<{ id: string; name: string; isActive?: boolean }>,
): CalendarSpaceOption[] {
  return spaces
    .filter((s) => s.isActive !== false)
    .map((s) => ({ id: s.id, name: s.name }));
}
