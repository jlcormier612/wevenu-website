/**
 * Timeline Templates → Bookings connection (2026-07-10). This file is new —
 * it doesn't modify lib/timeline-templates/service.ts, it just calls the
 * existing addEntry() once per template item so a Booking's Timeline is
 * built from real timeline_entries rows the same way a coordinator adding
 * them by hand would produce. There is no ongoing link back to the template
 * afterward — the Booking Timeline is a plain, independent copy.
 *
 * Updated by the Booking Timeline Experience task: timeline_entries gained
 * its own notes column, so a template item's notes now map straight across
 * instead of being folded into description — the same separation the
 * Timeline editor itself now offers.
 */

import { addEntry } from "@/lib/timeline/service";
import { minutesToTime, timeToMinutes } from "@/lib/timeline/constants";
import type { TimelineActionResult } from "@/lib/timeline/types";
import { getItems } from "@/lib/timeline-templates/service";

export async function applyTimelineTemplateToEvent(
  eventId: string, templateId: string, eventStartTime: string | null,
): Promise<TimelineActionResult> {
  const items = await getItems(templateId);
  if (items.length === 0) return { ok: false, message: "This timeline template has no items yet." };

  // Same "calculate from noon when no start time is set" fallback the
  // existing hardcoded-template picker already uses (components/events/
  // timeline/template-picker.tsx) — kept identical rather than inventing a
  // second convention for the same situation.
  const baseMinutes = timeToMinutes(eventStartTime || "12:00");

  for (const item of items) {
    let entryTime = item.timeOfDay ?? "";
    if (!entryTime && item.minutesOffset !== null) {
      // Same day-boundary guard as the existing hardcoded-template applier
      // (lib/timeline/repository.ts's applyTemplate) — an offset that lands
      // before midnight or past it leaves the entry untimed rather than
      // silently wrapping to a nonsensical clock time.
      const totalMinutes = baseMinutes + item.minutesOffset;
      if (totalMinutes >= 0 && totalMinutes < 24 * 60) entryTime = minutesToTime(totalMinutes);
    }
    const result = await addEntry(eventId, {
      title: item.title,
      description: item.description ?? "",
      notes: item.notes ?? "",
      entryTime,
      audiences: item.audiences,
    });
    if (!result.ok) return { ok: false, message: result.message ?? `Could not add "${item.title}".` };
  }

  return { ok: true };
}
