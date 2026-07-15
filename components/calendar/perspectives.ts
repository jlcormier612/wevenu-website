/**
 * Calendar Release Completion — Operational Perspectives.
 *
 * A Perspective is nothing but a named `CalendarFilterState` preset —
 * selecting one calls the exact same `setFilters` every manual filter
 * change already calls. No second filtering mechanism, no new query, no
 * new item construction. See docs/calendar-experience-completion.md for
 * the full architecture and docs/planning-execution-release-readiness.md-
 * style reasoning behind each perspective's exact scope.
 *
 * Two things every perspective definition below was checked against before
 * being written, not assumed:
 *   1. Which CalendarItemTypes actually appear on the venue-wide Month/
 *      Week/Day/Agenda views (`lib/calendar/service.ts` + the Tours
 *      projection) — `planning_task` and `timeline_entry` are real types
 *      but Booking-Schedule-lens only (Calendar Integration Phase 3); they
 *      never appear here, so they're deliberately omitted below rather than
 *      included and silently matching nothing.
 *   2. Which of the brief's own named examples don't map to anything real
 *      in the current data model — named honestly in each perspective's
 *      own comment rather than forced or invented:
 *        - "Requests related to leads" (Sales): requests.client_id is
 *          NOT NULL and there is no lead_id column at all; confirmed via
 *          real data that every existing Request's client is already
 *          status='planning' (booked). Requests are always post-booking.
 *          Not included in Sales.
 *        - "Financial reminders" (Finance): task_reminders.scheduled_for
 *          is not a wired Calendar item type (confirmed absent from
 *          getCalendarData's construction) — not included in Finance.
 *        - "Timeline" (Operations): same Booking-Schedule-only constraint
 *          as above — not included.
 *        - "Staff meetings" (Operations): no dedicated manualType exists;
 *          the closest bucket ("Other") is too broad to stand in for it
 *          without also catching unrelated personal/miscellaneous blocks.
 *          Not included.
 */
import type { CalendarItem, CalendarItemType } from "@/lib/calendar/types";
import type { ManualScheduleType } from "@/lib/availability/types";
import type { CalendarFilterState } from "@/components/calendar/use-calendar-filters";

export type PerspectiveId = "everything" | "sales" | "planning" | "finance" | "operations" | "wedding-day";

export type Perspective = {
  id: PerspectiveId;
  label: string;
  emoji: string;
  description: string;
  filters: CalendarFilterState;
};

const NO_FILTER: CalendarFilterState = { types: null, staffId: null, spaceId: null, manualTypes: null };

function preset(types: CalendarItemType[], manualTypes?: ManualScheduleType[]): CalendarFilterState {
  return { types, staffId: null, spaceId: null, manualTypes: manualTypes ?? null };
}

export const PERSPECTIVES: Perspective[] = [
  {
    id: "everything",
    label: "Everything",
    emoji: "🗓️",
    description: "Current behavior — no filter.",
    filters: NO_FILTER,
  },
  {
    id: "sales",
    label: "Sales",
    emoji: "🤝",
    description: "Tours, consultations, and lead follow-ups — nothing operational after booking.",
    filters: preset(["tour", "follow_up", "calendar_block"], ["tour", "consultation"]),
  },
  {
    id: "planning",
    label: "Planning",
    emoji: "📋",
    description: "Everything after booking — scheduled activities, walkthroughs, tastings, vendor and client meetings, Requests. Nothing financial.",
    // Requests can't be narrowed to "Planning" specifically — request_due
    // carries no sourceFeature on its CalendarItem — so every Request due
    // date is included here rather than mischaracterized as excluded; a
    // Request tied to a booking is, at minimum, still post-booking
    // operational work, matching this perspective's own "nothing
    // financial" boundary (Finance is expirations, not Requests).
    filters: preset(["planning_activity", "request_due", "calendar_block"], ["walkthrough", "tasting", "vendor_meeting", "client_meeting"]),
  },
  {
    id: "finance",
    label: "Finance",
    emoji: "💰",
    description: "Payments, contract expirations, document expirations. Nothing else.",
    filters: preset(["payment_due", "contract_expiration", "document_expiration"]),
  },
  {
    id: "operations",
    label: "Operations",
    emoji: "🧭",
    description: "The coordinator's day-to-day operational workload — scheduled activities, vendor meetings, walkthroughs, blocked time, and wedding days.",
    filters: preset(["planning_activity", "calendar_block", "event"], ["vendor_meeting", "walkthrough"]),
  },
  {
    id: "wedding-day",
    label: "Wedding Day",
    emoji: "💍",
    description: "Every wedding, venue-wide — one click still opens the Wedding Day dashboard.",
    filters: preset(["event"]),
  },
];

function filterStateEquals(a: CalendarFilterState, b: CalendarFilterState): boolean {
  const arrEq = (x: string[] | null, y: string[] | null) =>
    x === y || (x !== null && y !== null && x.length === y.length && x.every((v) => y.includes(v)));
  return arrEq(a.types, b.types) && arrEq(a.manualTypes, b.manualTypes) && a.staffId === b.staffId && a.spaceId === b.spaceId;
}

/** Which perspective (if any) the current filter state exactly matches — drives the switcher's own highlighted state, never a separately-tracked "mode" that could drift from the real filters. */
export function activePerspectiveId(filters: CalendarFilterState): PerspectiveId | null {
  const match = PERSPECTIVES.find((p) => filterStateEquals(p.filters, filters));
  return match?.id ?? null;
}

/**
 * Wedding Day is the one perspective that changes what a click does, not
 * just what's visible — "One click should still open the Wedding Day
 * dashboard. Calendar should never duplicate it." Applied only to the
 * already-filtered items of an active Wedding Day perspective, and only to
 * `event` items (the only type this perspective shows) — never a new
 * query, never a new item, just routing an existing link at the couple's
 * own wedding into the dashboard already built for that exact day.
 */
export function applyPerspectiveLinkOverrides(items: CalendarItem[], perspective: PerspectiveId | null): CalendarItem[] {
  if (perspective !== "wedding-day") return items;
  return items.map((item) =>
    item.type === "event" && item.eventId ? { ...item, link: `/events/${item.eventId}/today` } : item,
  );
}
