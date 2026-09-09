/**
 * Calendar Release Completion — Operational Perspectives.
 *
 * A Perspective is a named CalendarFilterState preset over the venue Calendar
 * schedule (Slice 1: scheduled / holds / blocked / appointments only — not
 * dated work or planning tasks).
 *
 * Finance was removed in Slice 2A.0/2A.1 — payment/expiration dates are not
 * venue Calendar items. Planning activities (event_tasks) are not either.
 */
import type { CalendarItem, CalendarItemType } from "@/lib/calendar/types";
import type { ManualScheduleType } from "@/lib/availability/types";
import type { CalendarFilterState } from "@/components/calendar/use-calendar-filters";

export type PerspectiveId = "everything" | "sales" | "planning" | "operations" | "wedding-day";

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

/** Base presets — Tasting is catalog-gated via getPerspectives(). */
export const PERSPECTIVES: Perspective[] = [
  {
    id: "everything",
    label: "Everything",
    emoji: "🗓️",
    description: "All scheduled events, appointments, holds, and blocked time.",
    filters: NO_FILTER,
  },
  {
    id: "sales",
    label: "Sales",
    emoji: "🤝",
    description: "Tours, consultations, and holds — pre-booking schedule.",
    filters: preset(["tour", "date_hold", "calendar_block"], [
      "consultation", "client_meeting", "custom",
    ]),
  },
  {
    id: "planning",
    label: "Planning",
    emoji: "📋",
    description: "Walkthroughs and client or vendor meetings.",
    filters: preset(["calendar_block"], [
      "walkthrough", "vendor_meeting", "client_meeting", "consultation", "custom",
    ]),
  },
  {
    id: "operations",
    label: "Operations",
    emoji: "🧭",
    description: "Wedding days, walkthroughs, vendor meetings, and blocked time.",
    filters: preset(["calendar_block", "event"], [
      "vendor_meeting", "walkthrough", "blocked_time", "personal_appointment", "other", "custom",
    ]),
  },
  {
    id: "wedding-day",
    label: "Wedding Day",
    emoji: "💍",
    description: "Booked events — one click opens the Wedding Day dashboard.",
    filters: preset(["event"]),
  },
];

const TASTING_PERSPECTIVE_IDS: PerspectiveId[] = ["sales", "planning"];

/**
 * Perspectives for the live venue Calendar. When Tasting is enabled in the
 * venue catalog, Sales/Planning include tasting as a filterable appointment
 * classification; otherwise tasting is omitted entirely.
 */
export function getPerspectives(tastingEnabled: boolean): Perspective[] {
  if (!tastingEnabled) return PERSPECTIVES;
  return PERSPECTIVES.map((p) => {
    if (!TASTING_PERSPECTIVE_IDS.includes(p.id)) return p;
    const manualTypes = p.filters.manualTypes ?? [];
    if (manualTypes.includes("tasting")) return p;
    return {
      ...p,
      filters: {
        ...p.filters,
        manualTypes: [...manualTypes, "tasting"],
      },
    };
  });
}

function filterStateEquals(a: CalendarFilterState, b: CalendarFilterState): boolean {
  const arrEq = (x: string[] | null, y: string[] | null) =>
    x === y || (x !== null && y !== null && x.length === y.length && x.every((v) => y.includes(v)));
  return arrEq(a.types, b.types) && arrEq(a.manualTypes, b.manualTypes) && a.staffId === b.staffId && a.spaceId === b.spaceId;
}

/** Which perspective (if any) the current filter state exactly matches — drives the switcher's own highlighted state, never a separately-tracked "mode" that could drift from the real filters. */
export function activePerspectiveId(
  filters: CalendarFilterState,
  tastingEnabled = false,
): PerspectiveId | null {
  const match = getPerspectives(tastingEnabled).find((p) => filterStateEquals(p.filters, filters));
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
