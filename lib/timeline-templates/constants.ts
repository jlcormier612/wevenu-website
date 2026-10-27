import { timeToMinutes } from "@/lib/timeline/constants";
import {
  formatRelativeToScheduleStart,
  formatTemplateDayLabelClear,
} from "@/lib/timeline/timing-presentation";
import {
  CLIENT_TIMELINE_AUDIENCES,
  TIMELINE_AUDIENCES,
  VENUE_TIMELINE_AUDIENCES,
} from "@/lib/timeline/types";
import type { TimelineAudience } from "@/lib/timeline/types";
import type { TimelineDayAnchor } from "@/lib/timeline/timing-presentation";

export { CLIENT_TIMELINE_AUDIENCES, TIMELINE_AUDIENCES, VENUE_TIMELINE_AUDIENCES };
export type { TimelineAudience };

/**
 * Venue-authored template audiences: keep only Client + Vendors.
 * Legacy tags (wedding_party, guests, venue) are dropped — not rejected —
 * so older template rows still apply cleanly.
 */
export function sanitizeVenueTemplateAudiences(audiences: TimelineAudience[]): TimelineAudience[] {
  const allowed = new Set<string>(["client", "vendors"]);
  return audiences.filter((a) => allowed.has(a));
}

/** Plain relative phrase for cards/lists (Day-of schedule start). */
export function formatMinutesOffset(minutes: number | null): string | null {
  if (minutes === null) return null;
  return formatRelativeToScheduleStart(minutes);
}

/**
 * Quick-pick offsets for the template day control (signed).
 * Full range is editable via the relative-day number field (±TEMPLATE_DAY_OFFSET_MAX).
 */
export const TEMPLATE_DAY_OFFSET_OPTIONS = [
  -3, -2, -1, 0, 1, 2, 3,
] as const;

/** Soft validation for template relative-day offsets (not a hard product limit of 7). */
export const TEMPLATE_DAY_OFFSET_MAX = 30;

export type { TimelineDayAnchor } from "@/lib/timeline/timing-presentation";

export function formatTemplateDayLabel(
  dayOffset: number,
  anchor: import("@/lib/timeline/timing-presentation").TimelineDayAnchor = "event_start",
): string {
  return formatTemplateDayLabelClear(dayOffset, anchor);
}

/** Presentation labels for Wedding Weekend (TL-03) day bands — not calendar dates. */
export function formatStarterTimelineDayLabel(
  dayOffset: number,
  sourceMasterKey?: string | null,
): string {
  if (sourceMasterKey === "TL-03") {
    if (dayOffset <= 0) return "Day Before";
    if (dayOffset === 1) return "Wedding Day";
    if (dayOffset === 2) return "Day After";
  }
  return formatTemplateDayLabel(dayOffset);
}

/**
 * Chronological sort key for a template activity (earliest → latest).
 *
 * Order:
 * 1. Relative day (dayOffset), earlier days first
 * 2. Day anchor: event_start before event_end on the same numeric offset
 * 3. Clock within the day:
 *    - relative minutesOffset (more negative = earlier)
 *    - then absolute timeOfDay
 *    - untimed last (do not invent a time)
 * 4. sortOrder (intentional tie-break / manual order among equals or untimed)
 * 5. createdAt when present
 *
 * Manual drag remains available as a tie-breaker among equal-time or untimed
 * activities. Distinct times always win over drag order so venues are not
 * forced to hand-sort 20–30 timed items.
 */
export type TimelineTemplateChronoFields = {
  dayOffset?: number | null;
  dayAnchor?: TimelineDayAnchor | null;
  minutesOffset?: number | null;
  timeOfDay?: string | null;
  sortOrder?: number | null;
  createdAt?: string | null;
};

function templateClockRank(item: TimelineTemplateChronoFields): {
  kind: number;
  value: number;
} {
  if (item.minutesOffset !== null && item.minutesOffset !== undefined) {
    return { kind: 0, value: item.minutesOffset };
  }
  const tod = item.timeOfDay?.trim();
  if (tod) {
    return { kind: 1, value: timeToMinutes(tod) };
  }
  return { kind: 2, value: 0 };
}

export function compareTimelineTemplateItems(
  a: TimelineTemplateChronoFields,
  b: TimelineTemplateChronoFields,
): number {
  const da = Math.trunc(a.dayOffset ?? 0);
  const db = Math.trunc(b.dayOffset ?? 0);
  if (da !== db) return da - db;

  const anchorA = a.dayAnchor === "event_end" ? 1 : 0;
  const anchorB = b.dayAnchor === "event_end" ? 1 : 0;
  if (anchorA !== anchorB) return anchorA - anchorB;

  const clockA = templateClockRank(a);
  const clockB = templateClockRank(b);
  if (clockA.kind !== clockB.kind) return clockA.kind - clockB.kind;
  if (clockA.kind < 2 && clockA.value !== clockB.value) return clockA.value - clockB.value;

  const sa = a.sortOrder ?? 0;
  const sb = b.sortOrder ?? 0;
  if (sa !== sb) return sa - sb;

  if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  return 0;
}

export function sortTimelineTemplateItems<T extends TimelineTemplateChronoFields>(items: T[]): T[] {
  return [...items].sort(compareTimelineTemplateItems);
}

/** Group template/starter items by dayOffset for library preview (chrono within day). */
export function groupTimelineItemsByDay<T extends { dayOffset?: number | null; title: string } & TimelineTemplateChronoFields>(
  items: T[],
): { dayOffset: number; items: T[] }[] {
  const sorted = sortTimelineTemplateItems(items);
  const map = new Map<number, T[]>();
  for (const item of sorted) {
    const d = Math.trunc(item.dayOffset ?? 0);
    const list = map.get(d) ?? [];
    list.push(item);
    map.set(d, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayOffset, groupItems]) => ({ dayOffset, items: groupItems }));
}
