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

import { createClient } from "@/integrations/supabase/server";
import { clampDayOffset, resolveEntryTimeFromOffset } from "@/lib/timeline/constants";
import { resolveTemplateDayToEventOffset } from "@/lib/timeline/timing-presentation";
import * as timelineRepo from "@/lib/timeline/repository";
import type { TimelineActionResult, TimelineAudience } from "@/lib/timeline/types";
import { getItems } from "@/lib/timeline-templates/service";
import type { TimelineTemplateItem } from "@/lib/timeline-templates/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function loadEventDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<{ eventDate: string | null; eventEndDate: string | null }> {
  const { data } = await supabase
    .from("events")
    .select("event_date, event_end_date")
    .eq("id", eventId)
    .maybeSingle<{ event_date: string | null; event_end_date: string | null }>();
  return {
    eventDate: data?.event_date ?? null,
    eventEndDate: data?.event_end_date ?? null,
  };
}

function entryDayOffsetFromTemplate(
  item: TimelineTemplateItem,
  eventDate: string | null,
  eventEndDate: string | null,
): number {
  const resolved = resolveTemplateDayToEventOffset(
    item.dayOffset ?? 0,
    item.dayAnchor ?? "event_start",
    eventDate,
    eventEndDate,
  );
  return clampDayOffset(resolved, eventDate, eventEndDate);
}

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
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const items = await getItems(templateId);
  if (items.length === 0) return { ok: false, message: "This timeline template has no items yet." };
  const { eventDate, eventEndDate } = await loadEventDates(supabase, eventId);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    // Prefer explicit clock anchors on the template item; otherwise resolve
    // from minutesOffset. When both are null, entryTime stays empty — starters
    // never invent fake times.
    const entryTime = item.timeOfDay
      ?? resolveEntryTimeFromOffset(item.minutesOffset, eventStartTime)
      ?? "";
    try {
      await timelineRepo.insertEntry(supabase, venue.id, eventId, {
        title: item.title,
        description: item.description ?? "",
        notes: item.notes ?? "",
        entryTime,
        dayOffset: entryDayOffsetFromTemplate(item, eventDate, eventEndDate),
        sortOrder: item.sortOrder ?? i,
        audiences: mapTemplateAudiencesForVenueOwnedApply(item.audiences),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : `Could not add "${item.title}".`;
      return { ok: false, message };
    }
  }

  return { ok: true };
}

/**
 * Event-specific timeline template switch for Overview setup.
 * Removes venue-owned entries on this event in one query, then applies the
 * selected Library template as a fresh event copy using one session client.
 * Client-owned entries are preserved. Does not share with the couple and does
 * not mutate the Library template.
 *
 * Prior implementation deleted/added each row through separate service
 * round-trips (N+M withVenue calls), which timed out on large templates and
 * surfaced as a page-load error with the original timeline still showing.
 */
export async function replaceEventTimelineFromTemplate(
  eventId: string,
  templateId: string,
  eventStartTime: string | null,
): Promise<TimelineActionResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const items = await getItems(templateId);
  if (items.length === 0) return { ok: false, message: "This timeline template has no items yet." };
  const { eventDate, eventEndDate } = await loadEventDates(supabase, eventId);

  const cleared = await timelineRepo.deleteVenueOwnedEntriesForEvent(supabase, venue.id, eventId);
  if (!cleared.ok) {
    return { ok: false, message: cleared.message };
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const entryTime = item.timeOfDay
      ?? resolveEntryTimeFromOffset(item.minutesOffset, eventStartTime)
      ?? "";
    try {
      await timelineRepo.insertEntry(supabase, venue.id, eventId, {
        title: item.title,
        description: item.description ?? "",
        notes: item.notes ?? "",
        entryTime,
        dayOffset: entryDayOffsetFromTemplate(item, eventDate, eventEndDate),
        sortOrder: item.sortOrder ?? i,
        audiences: mapTemplateAudiencesForVenueOwnedApply(item.audiences),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : `Could not add "${item.title}".`;
      return { ok: false, message };
    }
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
