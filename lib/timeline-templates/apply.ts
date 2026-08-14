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
import { resolveEntryTimeFromOffset } from "@/lib/timeline/constants";
import type { TimelineActionResult } from "@/lib/timeline/types";
import { getItems } from "@/lib/timeline-templates/service";

export async function applyTimelineTemplateToEvent(
  eventId: string, templateId: string, eventStartTime: string | null,
): Promise<TimelineActionResult> {
  const items = await getItems(templateId);
  if (items.length === 0) return { ok: false, message: "This timeline template has no items yet." };

  for (const item of items) {
    // Prefer explicit clock anchors on the template item; otherwise resolve
    // from minutesOffset. When both are null, entryTime stays empty — starters
    // never invent fake times.
    const entryTime = item.timeOfDay
      ?? resolveEntryTimeFromOffset(item.minutesOffset, eventStartTime)
      ?? "";
    const result = await addEntry(eventId, {
      title: item.title,
      description: item.description ?? "",
      notes: item.notes ?? "",
      entryTime,
      dayOffset: item.dayOffset ?? 0,
      audiences: item.audiences,
    });
    if (!result.ok) return { ok: false, message: result.message ?? `Could not add "${item.title}".` };
  }

  return { ok: true };
}
