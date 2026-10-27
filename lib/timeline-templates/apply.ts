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
import { clampDayOffset } from "@/lib/timeline/constants";
import { provenanceFromTemplateApply, timingDbColumns } from "@/lib/timeline/timing-provenance";
import * as timelineRepo from "@/lib/timeline/repository";
import type { TimelineActionResult, TimelineAudience } from "@/lib/timeline/types";
import {
  VENUE_TIMELINE_REPLACE_BLOCKED_MESSAGE,
} from "@/lib/timeline-templates/replace-guard";
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

function timingFromTemplateItem(
  item: TimelineTemplateItem,
  eventDate: string | null,
  eventEndDate: string | null,
  eventStartTime: string | null,
) {
  const write = provenanceFromTemplateApply({
    dayOffset: item.dayOffset ?? 0,
    dayAnchor: item.dayAnchor ?? "event_start",
    timeOfDay: item.timeOfDay,
    minutesOffset: item.minutesOffset,
    eventDate,
    eventEndDate,
    eventStartTime,
  });
  return {
    ...write,
    dayOffset: write.attention
      ? write.dayOffset
      : clampDayOffset(write.dayOffset, eventDate, eventEndDate),
    entryTime: write.entryTime ?? "",
  };
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
    const timing = timingFromTemplateItem(item, eventDate, eventEndDate, eventStartTime);
    try {
      await timelineRepo.insertEntry(supabase, venue.id, eventId, {
        title: item.title,
        description: item.description ?? "",
        notes: item.notes ?? "",
        entryTime: timing.entryTime,
        dayOffset: timing.dayOffset,
        sortOrder: item.sortOrder ?? i,
        audiences: mapTemplateAudiencesForVenueOwnedApply(item.audiences),
        timing,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : `Could not add "${item.title}".`;
      return { ok: false, message };
    }
  }

  return { ok: true };
}

/**
 * Event-specific timeline template switch for Overview setup (P2 / D5).
 * Blocks when any venue-owned working entries exist (including schedule-derived).
 * Eligible path (empty venue-owned set) inserts template items atomically via
 * SECURITY DEFINER RPC — no wipe of client-owned rows or release snapshots.
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

  const payload = items.map((item, i) => {
    const timing = timingFromTemplateItem(item, eventDate, eventEndDate, eventStartTime);
    const cols = timingDbColumns({
      ...timing,
      dayOffset: timing.dayOffset,
      entryTime: timing.entryTime || null,
    });
    return {
      title: item.title,
      description: item.description ?? "",
      notes: item.notes ?? "",
      entry_time: timing.entryTime || null,
      day_offset: timing.dayOffset,
      sort_order: item.sortOrder ?? i,
      audiences: mapTemplateAudiencesForVenueOwnedApply(item.audiences) ?? ["client"],
      lock_state: "locked",
      status: "not_started",
      timing_day_intent: cols.timing_day_intent ?? null,
      timing_day_anchor: cols.timing_day_anchor ?? null,
      timing_relative_day_offset: cols.timing_relative_day_offset ?? null,
      timing_day_offset_overridden: cols.timing_day_offset_overridden ?? false,
      timing_template_day_offset: cols.timing_template_day_offset ?? null,
      timing_template_day_anchor: cols.timing_template_day_anchor ?? null,
      timing_fixed_date: cols.timing_fixed_date ?? null,
      timing_clock_intent: cols.timing_clock_intent ?? null,
      timing_relative_minutes: cols.timing_relative_minutes ?? null,
      timing_clock_overridden: cols.timing_clock_overridden ?? false,
      timing_attention: cols.timing_attention ?? null,
    };
  });

  const { data, error } = await supabase.rpc("replace_venue_timeline_from_template_items", {
    p_event_id: eventId,
    p_items: payload,
  });
  if (error) {
    return { ok: false, message: error.message || "Could not switch the timeline template." };
  }
  const row = (data ?? {}) as { ok?: boolean; error?: string; message?: string; inserted?: number };
  if (row.ok !== true) {
    return {
      ok: false,
      message: String(row.message ?? VENUE_TIMELINE_REPLACE_BLOCKED_MESSAGE),
      errors: row.error ? { replace: String(row.error) } : undefined,
    };
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
    const timing = provenanceFromTemplateApply({
      dayOffset: item.dayOffset ?? 0,
      dayAnchor: item.dayAnchor ?? "event_start",
      timeOfDay: item.timeOfDay,
      minutesOffset: item.minutesOffset,
      eventDate: null,
      eventEndDate: null,
      eventStartTime,
      preserveDayOffset: item.dayOffset ?? 0,
    });
    const result = await addClientEntry(clientId, {
      title: item.title,
      description: item.description ?? "",
      notes: item.notes ?? "",
      entryTime: timing.entryTime ?? "",
      dayOffset: timing.dayOffset,
      audiences: mapTemplateAudiencesForVenueOwnedApply(item.audiences),
      timing,
    });
    if (!result.ok) return { ok: false, message: result.message ?? `Could not add "${item.title}".` };
  }
  return { ok: true };
}
