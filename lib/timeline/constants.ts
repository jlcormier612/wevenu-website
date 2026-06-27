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
