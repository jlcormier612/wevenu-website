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

type SpaceFilterItem = Pick<CalendarItem, "spaceId" | "spaceIds" | "type" | "id">;

/**
 * Items that apply to the venue as a whole, not to one physical space.
 *
 * - Tours (`tour_appointments`) never carry a space assignment.
 * - Tour availability exceptions project as Blocked Time without a space
 *   (`tour-exception-…` ids) — venue closures.
 * - Manual `calendar_blocks` have no space column in the Calendar projection,
 *   so they are venue schedule items (appointments, blocked time, placeholders).
 *
 * Events and date holds CAN be space-assigned. Missing space on those types
 * means unassigned — not attributed to a named space — not venue-wide.
 */
export function isVenueWideCalendarItem(item: SpaceFilterItem): boolean {
  if (item.type === "tour") return true;
  if (item.type === "calendar_block") return true;
  if (typeof item.id === "string" && item.id.startsWith("tour-exception-")) return true;
  return false;
}

/**
 * All spaces (null) → every item, including items with no space assignment.
 * A configured space → items associated with that space, plus venue-wide items.
 * Unassigned events/holds (space-capable types with no space) are never
 * attributed to a named space.
 */
export function calendarItemMatchesSpace(
  item: SpaceFilterItem,
  selectedSpaceId: string | null,
): boolean {
  const selected = normalizeCalendarSpaceFilterId(selectedSpaceId);
  if (!selected) return true;
  if (isVenueWideCalendarItem(item)) return true;
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
