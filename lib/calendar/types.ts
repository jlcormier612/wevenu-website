/**
 * Calendar domain types (Sprint 17 — Unified Calendar).
 * No new DB tables — aggregates data from existing tables.
 */

export type CalendarItemType =
  | "event"          // booked event (events table)
  | "tour"           // venue tour (tour_appointments — canonical regardless of entry point)
  | "follow_up"      // lead follow-up (leads.follow_up_date)
  | "payment_due"    // payment line item (payment_line_items.due_date)
  | "key_date"       // client milestone (client_key_dates.date)
  | "date_hold"      // soft reservation (date_holds table)
  | "calendar_block" // administrative closure (calendar_blocks table)
  | "planning_activity" // scheduled Planning task (event_tasks.scheduled_date — Calendar Integration Phase 1)
  | "request_due" // Request Framework due date (requests.due_date — Due Date kind, Calendar Integration Phase 2)
  | "contract_expiration" // Contract validity lapse (contracts.expires_at — Expiration kind, Calendar Integration Phase 2)
  | "document_expiration" // Document validity lapse (documents.expires_at — Expiration kind, Calendar Integration Phase 2)
  | "planning_task" // Planning due-date task, Deadline kind (event_tasks.due_date) — Booking Schedule lens only, Calendar Integration Phase 3
  | "timeline_entry"; // Booking Timeline / day-of run-of-show entry — Booking Schedule lens only, Calendar Integration Phase 3

export type CalendarItem = {
  id: string;
  type: CalendarItemType;
  date: string;        // ISO "YYYY-MM-DD"
  title: string;
  subtitle: string | null;
  time: string | null; // "HH:MM" start, if known
  /**
   * "HH:MM" end, for items that have a real finish time (manual Schedule
   * Items today). Null for all-day items and for every system-generated
   * type that only carries a start.
   */
  endTime?: string | null;
  link: string;        // route to navigate to on click
  rawId?: string;      // underlying DB record id for actionable types (e.g. calendar_block)
  // Passthrough metadata (Calendar Integration Phase 3) — every mapping
  // block already has access to these from its own query; exposing them
  // lets Week/Day/Agenda/Booking Schedule slice the exact same items by
  // booking without a second, parallel aggregation. Not a new computation —
  // just carrying along IDs the query already selected.
  eventId?: string | null;
  clientId?: string | null;
  // Filter metadata (Calendar Integration Phase 4) — same passthrough
  // principle as eventId/clientId above, not a new computation. Only
  // Planning items (event_tasks.assigned_to_staff_id) and the wedding-day
  // event item (events.space_id) carry these today; every other type
  // leaves them undefined, which the filter UI treats as "no assignment"/
  // "no space," never as an error.
  assignedToStaffId?: string | null;
  assignedToName?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
  // Calendar Manual Type Redesign — only calendar_block items carry this.
  // "Block" is now one of several manual schedule types a coordinator can
  // pick (Tour, Consultation, Client Meeting, Walkthrough, Tasting, Vendor
  // Meeting, Personal Appointment, Blocked Time, Other); this is what
  // rendering resolves icon/color/label from instead of the generic
  // "calendar_block" treatment. Never set on any other item type — a
  // system-generated item's own type already says everything it needs to.
  manualType?: import("@/lib/availability/types").ManualScheduleType | null;
  // Calendar Booking Placeholder — only set for calendar_block items whose
  // manualType is a Bookings type (wedding_event_booking/private_event).
  // Null/undefined for every other item, including every other manualType.
  convertedLeadId?: string | null;
  /**
   * "Related to" — the display name of the Lead/Client a manual Schedule Item
   * is about. The ids themselves reuse the existing leadId-free passthrough
   * fields above (clientId) plus leadId here, so filtering/linking works the
   * same way it does for every other item type.
   */
  leadId?: string | null;
  relatedName?: string | null;
};

/**
 * The year range the Calendar accepts from a URL and offers in its month/year
 * picker. Lives here, in the one calendar module with no server imports, so
 * the client picker and the server-side param validation share one definition
 * — a year reachable in the UI is always a year the resolver honours.
 */
export const CALENDAR_MIN_YEAR = 2020;
export const CALENDAR_MAX_YEAR = 2040;

/** One selectable target for a Schedule Item's optional "Related to" link. */
export type ScheduleRelationOption = {
  kind: "lead" | "client";
  id: string;
  name: string;
  eventDate: string | null;
};

export type CalendarData = {
  year: number;
  month: number; // 1-12
  items: CalendarItem[];
};
