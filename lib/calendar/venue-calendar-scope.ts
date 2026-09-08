/**
 * Calendar Slice 1 — venue Calendar display boundary.
 *
 * Venue Calendar shows scheduled / reserved / occupied / intentionally blocked
 * time only. Booking Schedule may still surface due dates and other dated work
 * for a single booking; those types remain on CalendarItemType for that lens.
 */
import type { CalendarItemType } from "@/lib/calendar/types";
import type { ManualScheduleType } from "@/lib/availability/types";

/** Item types produced by getCalendarData for the venue-wide Calendar. */
export const VENUE_CALENDAR_ITEM_TYPES = [
  "event",
  "tour",
  "date_hold",
  "calendar_block",
  "planning_activity",
] as const satisfies readonly CalendarItemType[];

export type VenueCalendarItemType = (typeof VENUE_CALENDAR_ITEM_TYPES)[number];

/** Dated facts that must not appear on the venue Calendar aggregation. */
export const VENUE_CALENDAR_EXCLUDED_ITEM_TYPES = [
  "follow_up",
  "payment_due",
  "key_date",
  "request_due",
  "contract_expiration",
  "document_expiration",
  "planning_task",
  "timeline_entry",
] as const satisfies readonly CalendarItemType[];

export function isVenueCalendarItemType(type: CalendarItemType): type is VenueCalendarItemType {
  return (VENUE_CALENDAR_ITEM_TYPES as readonly string[]).includes(type);
}

/** Manual types that remain in the DB check constraint but cannot be newly created (no catalog row). */
export const LEGACY_ONLY_MANUAL_SCHEDULE_TYPES = ["tour"] as const satisfies readonly ManualScheduleType[];

export function isLegacyOnlyManualScheduleType(type: ManualScheduleType): boolean {
  return (LEGACY_ONLY_MANUAL_SCHEDULE_TYPES as readonly string[]).includes(type);
}

/**
 * Strip excluded item types (and legacy manual-tour filters) from persisted
 * filter state so old localStorage cannot reintroduce noise after Slice 1.
 * Tasting stays filterable — it is catalog-gated, not permanently removed.
 */
export function sanitizeVenueCalendarFilters<T extends {
  types: CalendarItemType[] | null;
  manualTypes: ManualScheduleType[] | null;
  staffId: string | null;
  spaceId: string | null;
}>(filters: T): T {
  const types = filters.types
    ? filters.types.filter((t) => isVenueCalendarItemType(t))
    : null;
  const manualTypes = filters.manualTypes
    ? filters.manualTypes.filter((t) => !isLegacyOnlyManualScheduleType(t))
    : null;
  return {
    ...filters,
    types: types && types.length > 0 ? types : (filters.types ? [] : null),
    // Empty types array means "match nothing" when the user had only excluded
    // types saved; null still means "all venue types."
    manualTypes: manualTypes && manualTypes.length > 0 ? manualTypes : (filters.manualTypes ? [] : null),
  };
}
