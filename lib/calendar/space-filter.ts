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

/**
 * All spaces (null) → every item.
 * A configured space → items associated with that space only.
 * Unassigned items are never attributed to a named space.
 */
export function calendarItemMatchesSpace(
  item: Pick<CalendarItem, "spaceId" | "spaceIds">,
  selectedSpaceId: string | null,
): boolean {
  if (!selectedSpaceId) return true;
  const ids = spaceIdsForCalendarItem(item);
  if (selectedSpaceId === "__unassigned__") return ids.length === 0;
  return ids.includes(selectedSpaceId);
}

export function calendarSpaceOptionsFromVenueSpaces(
  spaces: Array<{ id: string; name: string; isActive?: boolean }>,
): CalendarSpaceOption[] {
  return spaces
    .filter((s) => s.isActive !== false)
    .map((s) => ({ id: s.id, name: s.name }));
}
