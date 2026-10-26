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

/** Group template/starter items by dayOffset for library preview. */
export function groupTimelineItemsByDay<T extends { dayOffset?: number | null; title: string }>(
  items: T[],
): { dayOffset: number; items: T[] }[] {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const d = Math.trunc(item.dayOffset ?? 0);
    const list = map.get(d) ?? [];
    list.push(item);
    map.set(d, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayOffset, groupItems]) => ({ dayOffset, items: groupItems }));
}
