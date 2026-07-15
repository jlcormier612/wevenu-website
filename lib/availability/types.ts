/**
 * Availability & Inventory types (Sprint 20).
 */

export type VenueSpace = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  capacity: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type VenueCapacityRules = {
  id: string;
  venueId: string;
  maxSimultaneousEvents: number;
  maxSimultaneousTours: number;
  minTurnaroundHours: number;
  createdAt: string;
  updatedAt: string;
};

export type HoldStatus = "active" | "converted" | "released" | "expired";

export type DateHold = {
  id: string;
  venueId: string;
  leadId: string | null;
  spaceId: string | null;
  title: string;
  holdDate: string;
  startTime: string | null;
  endTime: string | null;
  status: HoldStatus;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Embedded
  leadName: string | null;
  spaceName: string | null;
};

export type BlockReason =
  | "maintenance"
  | "private_event"
  | "holiday"
  | "staff_training"
  | "other";

export type RecurrenceRule = "none" | "daily" | "weekly" | "annual";

// Calendar Manual Type Redesign — a manual entry is one of these types;
// "Blocked Time" replaces the old single-purpose "Block" concept as just
// one option among several, not the primary one. Every type but the two
// Booking types has no fields beyond the shared ones — reason (BlockReason)
// stays meaningful only for blocked_time; event_type/client_name/
// guestCount/estimatedRevenue/convertedLeadId stay meaningful only for
// wedding_event_booking/private_event (Calendar Booking Placeholder).
export const MANUAL_SCHEDULE_TYPES = [
  "tour", "consultation", "client_meeting", "walkthrough", "tasting",
  "vendor_meeting", "wedding_event_booking", "private_event",
  "personal_appointment", "blocked_time", "other",
] as const;
export type ManualScheduleType = (typeof MANUAL_SCHEDULE_TYPES)[number];

// The "Schedule Item" picker groups types this way — a venue thinks in
// terms of Meetings/Bookings/Availability/Other, not one flat list.
export const MANUAL_SCHEDULE_TYPE_GROUPS: { label: string; types: ManualScheduleType[] }[] = [
  { label: "Meetings", types: ["tour", "consultation", "client_meeting", "walkthrough", "tasting", "vendor_meeting"] },
  { label: "Bookings", types: ["wedding_event_booking", "private_event"] },
  { label: "Availability", types: ["blocked_time", "personal_appointment"] },
  { label: "Other", types: ["other"] },
];

export const BOOKING_SCHEDULE_TYPES: ManualScheduleType[] = ["wedding_event_booking", "private_event"];

export function isBookingPlaceholder(type: ManualScheduleType): boolean {
  return BOOKING_SCHEDULE_TYPES.includes(type);
}

export type CalendarBlock = {
  id: string;
  venueId: string;
  title: string;
  type: ManualScheduleType;
  reason: BlockReason | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  recurrenceRule: RecurrenceRule;
  recurrenceEndsOn: string | null;
  createdAt: string;
  // Calendar Booking Placeholder — meaningful only when type is one of
  // BOOKING_SCHEDULE_TYPES; null for every other manual schedule type.
  eventType: string | null;
  clientName: string | null;
  guestCount: number | null;
  estimatedRevenue: number | null;
  /** Set once "Convert to Booking" creates a real Lead from this placeholder — the placeholder stays, as a receipt of where the date's booking came from. */
  convertedLeadId: string | null;
};

// ---- Conflict detection types -----------------------------------------------

export type ConflictType =
  | "event_capacity_full"  // max simultaneous events reached
  | "tour_capacity_full"   // max simultaneous tours reached
  | "calendar_blocked"     // administrative block on this date
  | "space_booked"         // the specific space is already taken
  | "hold_exists";         // an active date hold exists

export type ConflictItem = {
  type: ConflictType;
  message: string;
  severity: "warning" | "error"; // warning = can override; error = hard block
};

export type AvailabilityStatus = {
  available: boolean;
  conflicts: ConflictItem[];
};

// ---- Input types ------------------------------------------------------------

export type SpaceInput = {
  name: string;
  description: string;
  capacity: string;
  isActive: boolean;
};

export type CapacityRulesInput = {
  maxSimultaneousEvents: number;
  maxSimultaneousTours: number;
  minTurnaroundHours: number;
};

export type DateHoldInput = {
  leadId: string;
  spaceId: string;
  title: string;
  holdDate: string;
  startTime: string;
  endTime: string;
  expiresAt: string;
  notes: string;
};

export type CalendarBlockInput = {
  title: string;
  type: ManualScheduleType;
  /** Only meaningful when type === "blocked_time"; ignored otherwise. */
  reason: BlockReason | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  startTime: string;
  endTime: string;
  notes: string;
  recurrenceRule: RecurrenceRule;
  recurrenceEndsOn: string | null;
  /** Only meaningful when type is one of BOOKING_SCHEDULE_TYPES; ignored otherwise. */
  eventType: string;
  clientName: string;
  guestCount: string;
  estimatedRevenue: string;
};

export type AvailabilityActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type CreateSpaceResult =
  | { ok: true; spaceId: string }
  | { ok: false; message?: string };

export type CreateHoldResult =
  | { ok: true; holdId: string }
  | { ok: false; message?: string };

export type ConvertScheduleItemResult =
  | { ok: true; leadId: string }
  | { ok: false; message?: string };
