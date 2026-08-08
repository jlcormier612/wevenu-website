/**
 * Timeline reference data and hardcoded templates (Sprint 12).
 *
 * Templates are stored here as application data — no DB table needed.
 * Each template entry has a `minutesOffset` relative to the event's start_time
 * (0 = event start, -60 = 1 hour before, +120 = 2 hours after).
 */

export type TemplateEntry = {
  title: string;
  description?: string;
  minutesOffset: number; // minutes from event start_time
};

export type TimelineTemplate = {
  id: string;
  name: string;
  description: string;
  entryCount: number; // shown in the picker UI
  entries: TemplateEntry[];
};

export const TIMELINE_TEMPLATES: TimelineTemplate[] = [
  {
    id: "wedding-classic",
    name: "Wedding — Classic",
    description: "Full-day wedding from setup through teardown.",
    entryCount: 14,
    entries: [
      { title: "Setup crew arrives", minutesOffset: -360 },
      { title: "Florist and décor team begin setup", minutesOffset: -300 },
      { title: "Catering team arrives", minutesOffset: -240 },
      { title: "Venue ready for photography", minutesOffset: -120 },
      { title: "Bridal party pre-ceremony photos", minutesOffset: -90 },
      { title: "Doors open — guests begin arriving", minutesOffset: -30 },
      { title: "Ceremony begins", description: "All guests seated.", minutesOffset: 0 },
      { title: "Ceremony ends", minutesOffset: 60 },
      { title: "Cocktail hour begins", minutesOffset: 60 },
      { title: "Couple photos — golden hour", minutesOffset: 90 },
      { title: "Reception opens — dinner service", minutesOffset: 120 },
      { title: "First dance", minutesOffset: 150 },
      { title: "Cake cutting", minutesOffset: 210 },
      { title: "Last song — event ends", minutesOffset: 360 },
      { title: "Teardown begins", minutesOffset: 360 },
    ],
  },
  {
    id: "wedding-simple",
    name: "Wedding — Essentials",
    description: "Core milestones for an intimate or shorter ceremony.",
    entryCount: 8,
    entries: [
      { title: "Setup and preparation", minutesOffset: -180 },
      { title: "Guests begin arriving", minutesOffset: -30 },
      { title: "Ceremony begins", minutesOffset: 0 },
      { title: "Ceremony ends", minutesOffset: 60 },
      { title: "Reception begins", minutesOffset: 90 },
      { title: "Dinner service", minutesOffset: 120 },
      { title: "Cake cutting", minutesOffset: 180 },
      { title: "Event concludes", minutesOffset: 240 },
    ],
  },
  {
    id: "corporate-halfday",
    name: "Corporate — Half Day",
    description: "Morning or afternoon professional event.",
    entryCount: 7,
    entries: [
      { title: "A/V and room setup", minutesOffset: -60 },
      { title: "Doors open — registration and networking", minutesOffset: 0 },
      { title: "Welcome remarks — event begins", minutesOffset: 15 },
      { title: "Main session", minutesOffset: 30 },
      { title: "Break", minutesOffset: 120 },
      { title: "Session resumes", minutesOffset: 135 },
      { title: "Closing remarks — event concludes", minutesOffset: 240 },
      { title: "Venue breakdown", minutesOffset: 240 },
    ],
  },
  {
    id: "celebration",
    name: "Birthday / Celebration",
    description: "Arrival through celebration and cake.",
    entryCount: 6,
    entries: [
      { title: "Setup and decorations", minutesOffset: -60 },
      { title: "Guests arrive", minutesOffset: 0 },
      { title: "Welcome and introductions", minutesOffset: 30 },
      { title: "Dinner service", minutesOffset: 60 },
      { title: "Cake and dessert", minutesOffset: 120 },
      { title: "Music and dancing", minutesOffset: 150 },
      { title: "Event concludes", minutesOffset: 240 },
    ],
  },
];

/** Convert "HH:MM" to total minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Convert total minutes since midnight to "HH:MM". Clamps to 00:00–23:59. */
export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(1439, ((mins % 1440) + 1440) % 1440));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format "HH:MM" as "10:00 AM". */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Add whole calendar days to a YYYY-MM-DD string (local noon to avoid DST edges). */
export function addDaysToIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Inclusive day count for an event range (1 for single-day). */
export function eventDayCount(eventDate: string | null | undefined, eventEndDate?: string | null): number {
  if (!eventDate) return 1;
  if (!eventEndDate || eventEndDate <= eventDate) return 1;
  const start = new Date(`${eventDate}T12:00:00`);
  const end = new Date(`${eventEndDate}T12:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

/** Max valid day_offset (0 for single-day). */
export function maxDayOffset(eventDate: string | null | undefined, eventEndDate?: string | null): number {
  return eventDayCount(eventDate, eventEndDate) - 1;
}

export function isMultiDayEvent(eventDate: string | null | undefined, eventEndDate?: string | null): boolean {
  return maxDayOffset(eventDate, eventEndDate) > 0;
}

/** Soft-clamp day_offset into the event span. */
export function clampDayOffset(
  offset: number | null | undefined,
  eventDate: string | null | undefined,
  eventEndDate?: string | null,
): number {
  const n = Number.isFinite(offset as number) ? Math.trunc(offset as number) : 0;
  const max = maxDayOffset(eventDate, eventEndDate);
  return Math.max(0, Math.min(max, n));
}

/** Calendar day options for a multi-day Day dropdown (Day 1 · Fri Oct 17). */
export function timelineDayOptions(
  eventDate: string,
  eventEndDate?: string | null,
): { value: number; label: string; isoDate: string }[] {
  const count = eventDayCount(eventDate, eventEndDate);
  return Array.from({ length: count }, (_, dayOffset) => {
    const isoDate = addDaysToIsoDate(eventDate, dayOffset);
    const short = new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    return {
      value: dayOffset,
      label: `Day ${dayOffset + 1} · ${short}`,
      isoDate,
    };
  });
}

/** Day band header — "Saturday, Oct 18". */
export function formatTimelineDayHeader(eventDate: string, dayOffset: number): string {
  const iso = addDaysToIsoDate(eventDate, dayOffset);
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });
}

/**
 * Upcoming / Today — calendar-derived schedule chips (not completion).
 * Compares calendar today to event_date + day_offset.
 */
export function getDueStatus(
  eventDate: string | null,
  dayOffset = 0,
): import("@/lib/timeline/types").TimelineDueStatus {
  if (!eventDate) return "upcoming";
  const entryDay = addDaysToIsoDate(eventDate, dayOffset);
  if (entryDay === new Date().toISOString().slice(0, 10)) return "today";
  return "upcoming";
}

/** Sort comparator: day_offset, entry_time (nulls last), sort_order. */
export function compareTimelineEntries(
  a: { dayOffset?: number; entryTime: string | null; sortOrder: number; createdAt?: string },
  b: { dayOffset?: number; entryTime: string | null; sortOrder: number; createdAt?: string },
): number {
  const da = a.dayOffset ?? 0;
  const db = b.dayOffset ?? 0;
  if (da !== db) return da - db;
  if ((a.entryTime ?? "") !== (b.entryTime ?? "")) {
    if (a.entryTime == null) return 1;
    if (b.entryTime == null) return -1;
    return a.entryTime < b.entryTime ? -1 : 1;
  }
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  return 0;
}
