/**
 * Hello to Cheers — Starter Timeline Templates.
 *
 * Activities and sequence only. No fake clock times (timeOfDay / minutesOffset
 * stay null until the venue sets times on a Working Timeline).
 * Multi-day: Wedding Weekend uses dayOffset 0/1/2 (Day Before / Wedding Day / Day After).
 */

export type TimelineStarterMasterKey = "TL-01" | "TL-02" | "TL-03";

export type TimelineStarterItem = {
  title: string;
  description?: string | null;
  /** 0-based day relative to event start when applied. */
  dayOffset: number;
};

export type TimelineStarterMaster = {
  key: TimelineStarterMasterKey;
  name: string;
  description: string;
  eventType: string | null;
  items: TimelineStarterItem[];
};

const act = (title: string, dayOffset = 0, description?: string): TimelineStarterItem => ({
  title,
  dayOffset,
  description: description ?? null,
});

/** Shared wedding-day activity titles (apply dayOffset via mapDays). */
export const STANDARD_WEDDING_DAY_TITLES: readonly string[] = [
  "Venue Access / Team Arrival",
  "Venue Setup Begins",
  "Rentals / Inventory Setup",
  "Vendor Load-In",
  "Catering Setup",
  "Bar Setup",
  "Ceremony Setup",
  "Reception Setup",
  "Final Venue Walkthrough",
  "Guest Arrival",
  "Ceremony Seating",
  "Ceremony Begins",
  "Ceremony Ends",
  "Family / Wedding Party Photos",
  "Guest Transition to Cocktail Hour",
  "Cocktail Hour Begins",
  "Bar Service Begins",
  "Passed Appetizers / Cocktail Service",
  "Couple Photos",
  "Reception Room Final Check",
  "Guests Invited to Reception",
  "Reception Begins",
  "Grand Entrance",
  "Welcome / Opening Remarks",
  "Dinner Service Begins",
  "Dinner Service Complete",
  "Toasts / Speeches",
  "First Dance",
  "Parent / Family Dances",
  "Cake Cutting",
  "Dessert Service",
  "Open Dancing",
  "Last Call / Final Service",
  "Final Guest Departure",
  "Vendor Load-Out",
  "Personal Items Collected",
  "Venue Breakdown",
  "Event Closeout",
] as const;

const RECEPTION_ONLY_TITLES: readonly string[] = [
  "Venue Access / Team Arrival",
  "Venue Setup Begins",
  "Vendor Load-In",
  "Catering Setup",
  "Bar Setup",
  "Reception Setup",
  "Final Venue Walkthrough",
  "Guest Arrival",
  "Bar Service Begins",
  "Reception Seating",
  "Couple / Wedding Party Arrival",
  "Reception Begins",
  "Grand Entrance",
  "Welcome / Opening Remarks",
  "Dinner Service Begins",
  "Dinner Service Complete",
  "Toasts / Speeches",
  "First Dance",
  "Parent / Family Dances",
  "Cake Cutting",
  "Dessert Service",
  "Open Dancing",
  "Last Call / Final Service",
  "Final Guest Departure",
  "Vendor Load-Out",
  "Personal Items Collected",
  "Venue Breakdown",
  "Event Closeout",
] as const;

const DAY_BEFORE_TITLES: readonly string[] = [
  "Venue Access",
  "Rehearsal Setup",
  "Rehearsal",
  "Rehearsal Dinner",
  "Welcome Event",
  "End of Evening",
] as const;

const DAY_AFTER_TITLES: readonly string[] = [
  "Client / Personal Item Pickup",
  "Rental Return / Pickup",
  "Venue Closeout",
  "Final Client Follow-Up",
] as const;

function mapDays(titles: readonly string[], dayOffset: number): TimelineStarterItem[] {
  return titles.map((title) => act(title, dayOffset));
}

export const TIMELINE_STARTER_MASTERS: readonly TimelineStarterMaster[] = [
  {
    key: "TL-01",
    name: "Standard Wedding Day Timeline",
    description:
      "A practical starting timeline for a wedding day with both a ceremony and reception. Customize the activities and times to match the way your venue runs events.",
    eventType: "wedding",
    items: mapDays(STANDARD_WEDDING_DAY_TITLES, 0),
  },
  {
    key: "TL-02",
    name: "Reception Only Timeline",
    description:
      "A starting timeline for weddings where the reception is held at your venue without an on-site ceremony.",
    eventType: "wedding",
    items: mapDays(RECEPTION_ONLY_TITLES, 0),
  },
  {
    key: "TL-03",
    name: "Wedding Weekend Timeline",
    description:
      "A starting timeline for events that span multiple days, from rehearsal and welcome events through the wedding and closeout.",
    eventType: "wedding",
    items: [
      ...mapDays(DAY_BEFORE_TITLES, 0),
      ...mapDays(STANDARD_WEDDING_DAY_TITLES, 1),
      ...mapDays(DAY_AFTER_TITLES, 2),
    ],
  },
] as const;

export function getTimelineStarterMaster(key: string): TimelineStarterMaster | undefined {
  return TIMELINE_STARTER_MASTERS.find((m) => m.key === key);
}

/**
 * Hardcoded booking-picker shape (Sprint 12) — same approved content, no
 * invented minutesOffset. Prefer Library templates when present.
 */
export type BookingPickerStarter = {
  id: string;
  name: string;
  description: string;
  entryCount: number;
  entries: Array<{ title: string; description?: string; minutesOffset: null; dayOffset: number }>;
};

export function getBookingPickerStarters(): BookingPickerStarter[] {
  return TIMELINE_STARTER_MASTERS.map((m) => ({
    id: m.key,
    name: m.name,
    description: m.description,
    entryCount: m.items.length,
    entries: m.items.map((i) => ({
      title: i.title,
      description: i.description ?? undefined,
      minutesOffset: null,
      dayOffset: i.dayOffset,
    })),
  }));
}

/**
 * Pure skip rules used by provision (unit-tested). Never overwrite an existing
 * key or same-named customized template for the venue.
 */
export function shouldSkipTimelineStarterProvision(opts: {
  masterKey: string;
  masterName: string;
  existingByKey: Set<string>;
  existingNames: Set<string>;
}): "skip_key" | "skip_name" | "create" {
  if (opts.existingByKey.has(opts.masterKey)) return "skip_key";
  if (opts.existingNames.has(opts.masterName)) return "skip_name";
  return "create";
}
