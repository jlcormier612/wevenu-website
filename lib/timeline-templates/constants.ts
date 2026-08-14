import { TIMELINE_AUDIENCES, VENUE_TIMELINE_AUDIENCES } from "@/lib/timeline/types";
import type { TimelineAudience } from "@/lib/timeline/types";

export { TIMELINE_AUDIENCES, VENUE_TIMELINE_AUDIENCES };
export type { TimelineAudience };

/** Strip guests from venue-authored template audiences. */
export function sanitizeVenueTemplateAudiences(audiences: TimelineAudience[]): TimelineAudience[] {
  const next = audiences.filter((a) => a !== "guests");
  return next.length > 0 ? next : ["venue"];
}

/** "+90 min" / "-30 min" / "At event start", for card and list display. */
export function formatMinutesOffset(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes === 0) return "At event start";
  const sign = minutes > 0 ? "+" : "-";
  return `${sign}${Math.abs(minutes)} min`;
}

/** Template Day picker — no calendar dates; labels are Day 1 / Day 2 / … */
export const TEMPLATE_DAY_OFFSET_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const;

export function formatTemplateDayLabel(dayOffset: number): string {
  return `Day ${Math.max(0, Math.trunc(dayOffset)) + 1}`;
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
    const d = Math.max(0, Math.trunc(item.dayOffset ?? 0));
    const list = map.get(d) ?? [];
    list.push(item);
    map.set(d, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayOffset, groupItems]) => ({ dayOffset, items: groupItems }));
}
