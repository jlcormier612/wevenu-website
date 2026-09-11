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
] as const satisfies readonly CalendarItemType[];

export type VenueCalendarItemType = (typeof VENUE_CALENDAR_ITEM_TYPES)[number];

/** Dated facts that must not appear on the venue Calendar aggregation. */
export const VENUE_CALENDAR_EXCLUDED_ITEM_TYPES = [
  "follow_up",
  "payment_due",
  "request_due",
  "contract_expiration",
  "document_expiration",
  "planning_task",
  "timeline_entry",
  "planning_activity",
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
 * Tasting stays filterable when enabled — it is catalog-gated, not permanently removed.
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

/**
 * Manual schedule subtypes that are Appointment classifications (not
 * top-level Calendar concepts). Used for nested filtering / perspectives —
 * never as peer-level venue Calendar legend entries.
 */
export const VENUE_CALENDAR_APPOINTMENT_CLASSIFICATIONS = [
  "consultation",
  "client_meeting",
  "vendor_meeting",
  "walkthrough",
  "tasting",
  "personal_appointment",
  "other",
  "custom",
] as const satisfies readonly ManualScheduleType[];

/** @deprecated Prefer VENUE_CALENDAR_APPOINTMENT_CLASSIFICATIONS — legend no longer lists these. */
export const VENUE_CALENDAR_LEGEND_MANUAL_TYPES = [
  "consultation",
  "client_meeting",
  "vendor_meeting",
  "walkthrough",
  "tasting",
  "personal_appointment",
  "other",
  "wedding_event_booking",
] as const satisfies readonly ManualScheduleType[];

/** Hold placeholders stored as calendar_block rows. */
export const VENUE_CALENDAR_HOLD_MANUAL_TYPES = [
  "wedding_event_booking",
  "private_event",
] as const satisfies readonly ManualScheduleType[];

/**
 * Locked top-level venue Calendar taxonomy (Product).
 * Appointment classifications are never peers of these concepts.
 */
export const VENUE_CALENDAR_TAXONOMY = [
  "event",
  "tour",
  "appointment",
  "hold",
  "blocked_time",
] as const;

export type VenueCalendarTaxonomyKey = (typeof VENUE_CALENDAR_TAXONOMY)[number];

export function venueCalendarTaxonomyKey(item: {
  type: CalendarItemType;
  manualType?: ManualScheduleType | null;
}): VenueCalendarTaxonomyKey | null {
  if (item.type === "event") return "event";
  if (item.type === "tour") return "tour";
  if (item.type === "date_hold") return "hold";
  if (item.type === "calendar_block") {
    const mt = item.manualType ?? null;
    if (mt === "blocked_time") return "blocked_time";
    if (mt && (VENUE_CALENDAR_HOLD_MANUAL_TYPES as readonly string[]).includes(mt)) return "hold";
    // Appointments (including legacy manual tour rows and unclassified other)
    return "appointment";
  }
  return null;
}

export function venueCalendarTaxonomyLabel(key: VenueCalendarTaxonomyKey): string {
  switch (key) {
    case "event": return "Event";
    case "tour": return "Tour";
    case "appointment": return "Appointment";
    case "hold": return "Hold";
    case "blocked_time": return "Blocked Time";
  }
}
