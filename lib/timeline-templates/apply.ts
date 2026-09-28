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
import type { TimelineActionResult, TimelineAudience } from "@/lib/timeline/types";
import { getItems } from "@/lib/timeline-templates/service";

/**
 * Library template items historically stored audience tag "venue" to mean
 * venue-internal / not shared with the couple. Venue-owned working entries
 * express that as an empty audience list (venue-private). The "venue" share
 * tag is only valid on client-owned items (couple sharing with the venue).
 *
 * Returns undefined when the template omitted audiences so insert defaults apply.
 */
export function mapTemplateAudiencesForVenueOwnedApply(
  audiences: TimelineAudience[] | undefined,
): TimelineAudience[] | undefined {
  if (audiences === undefined) return undefined;
  return audiences.filter((a) => a !== "venue");
}

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
      audiences: mapTemplateAudiencesForVenueOwnedApply(item.audiences),
    });
    if (!result.ok) return { ok: false, message: result.message ?? `Could not add "${item.title}".` };
  }

  return { ok: true };
}

export async function applyTimelineTemplateToClient(
  clientId: string, templateId: string, eventStartTime: string | null,
): Promise<TimelineActionResult> {
  const items = await getItems(templateId);
  if (items.length === 0) return { ok: false, message: "This timeline template has no items yet." };
  const { addClientEntry } = await import("@/lib/timeline/service");
  for (const item of items) {
    const entryTime = item.timeOfDay
      ?? resolveEntryTimeFromOffset(item.minutesOffset, eventStartTime)
      ?? "";
    const result = await addClientEntry(clientId, {
      title: item.title,
      description: item.description ?? "",
      notes: item.notes ?? "",
      entryTime,
      dayOffset: item.dayOffset ?? 0,
      audiences: mapTemplateAudiencesForVenueOwnedApply(item.audiences),
    });
    if (!result.ok) return { ok: false, message: result.message ?? `Could not add "${item.title}".` };
  }
  return { ok: true };
}
