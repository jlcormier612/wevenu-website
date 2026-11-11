/**
 * Timeline P1c — server preview/confirm for working timing recalculation.
 * Never writes venue_timeline_releases or events.active_venue_timeline_release_id.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { normalizeEventEndDate } from "@/lib/events/constants";
import * as repo from "@/lib/timeline/repository";
import {
  buildTimingRecalcPreview,
  workingPatchForRecalcRow,
  type TimingRecalcPreview,
} from "@/lib/timeline/timing-recalc";
import { timingDbColumns, type TimingWrite } from "@/lib/timeline/timing-provenance";
import { getCurrentVenue } from "@/lib/venue/service";

export type TimingRecalcActionResult =
  | { ok: true; preview: TimingRecalcPreview }
  | { ok: true; applied: number; fingerprint: string }
  | { ok: false; error?: string; message: string; preview?: TimingRecalcPreview };

async function activeReleaseEntryIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventId: string,
): Promise<{ hasActiveRelease: boolean; ids: Set<string> }> {
  const { data: ev } = await supabase
    .from("events")
    .select("active_venue_timeline_release_id")
    .eq("id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle<{ active_venue_timeline_release_id: string | null }>();
  const releaseId = ev?.active_venue_timeline_release_id ?? null;
  if (!releaseId) return { hasActiveRelease: false, ids: new Set() };
  const { data: rel } = await supabase
    .from("venue_timeline_releases")
    .select("snapshot")
    .eq("id", releaseId)
    .eq("venue_id", venueId)
    .maybeSingle<{ snapshot: Array<{ id?: string }> | null }>();
  const ids = new Set<string>();
  for (const row of rel?.snapshot ?? []) {
    if (row?.id) ids.add(String(row.id));
  }
  return { hasActiveRelease: true, ids };
}

export async function previewEventTimingRecalc(input: {
  eventId: string;
  previousEventDate: string;
  previousEndDate: string | null;
  previousStartTime: string | null;
}): Promise<TimingRecalcActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };

  const { data: event, error } = await supabase
    .from("events")
    .select("id,event_date,event_end_date,start_time")
    .eq("id", input.eventId)
    .eq("venue_id", venue.id)
    .maybeSingle<{
      id: string;
      event_date: string;
      event_end_date: string | null;
      start_time: string | null;
    }>();
  if (error || !event) return { ok: false, message: "Event not found." };

  const nextEnd = normalizeEventEndDate(event.event_date, event.event_end_date);
  const nextStart = event.start_time?.slice(0, 5) ?? null;
  const dateChanged =
    input.previousEventDate !== event.event_date
    || (input.previousEndDate ?? null) !== (nextEnd ?? null);
  const startChanged = (input.previousStartTime ?? null) !== nextStart;
  if (!dateChanged && !startChanged) {
    return { ok: false, message: "Wedding dates and Day-of start did not change." };
  }

  const entries = await repo.getTimelineEntries(supabase, venue.id, input.eventId);
  const release = await activeReleaseEntryIds(supabase, venue.id, input.eventId);
  const preview = buildTimingRecalcPreview({
    eventId: input.eventId,
    entries,
    activeReleaseEntryIds: release.ids,
    hasActiveRelease: release.hasActiveRelease,
    previousEventDate: input.previousEventDate,
    previousEndDate: input.previousEndDate,
    previousStartTime: input.previousStartTime,
    nextEventDate: event.event_date,
    nextEndDate: nextEnd,
    nextStartTime: nextStart,
  });
  return { ok: true, preview };
}

export async function confirmEventTimingRecalc(input: {
  eventId: string;
  fingerprint: string;
  previousEventDate: string;
  previousEndDate: string | null;
  previousStartTime: string | null;
}): Promise<TimingRecalcActionResult> {
  const previewed = await previewEventTimingRecalc({
    eventId: input.eventId,
    previousEventDate: input.previousEventDate,
    previousEndDate: input.previousEndDate,
    previousStartTime: input.previousStartTime,
  });
  if (!previewed.ok || !("preview" in previewed)) return previewed;
  const preview = previewed.preview;
  if (preview.fingerprint !== input.fingerprint) {
    return {
      ok: false,
      error: "stale_preview",
      message: "The timeline or wedding dates changed since you reviewed this list. Review again before applying.",
      preview,
    };
  }

  const eligible = preview.rows.filter((r) => r.eligible);
  if (eligible.length === 0) {
    return { ok: true, applied: 0, fingerprint: preview.fingerprint };
  }

  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const entries = await repo.getTimelineEntries(supabase, venue.id, input.eventId);
  const byId = new Map(entries.map((e) => [e.id, e]));

  const updates: Array<{
    id: string;
    day_offset: number;
    entry_time: string | null;
    timing: Record<string, unknown>;
  }> = [];
  for (const row of eligible) {
    const entry = byId.get(row.entryId);
    if (!entry || entry.owner !== "venue") {
      return {
        ok: false,
        error: "stale_preview",
        message: "A timeline item changed since you reviewed this list. Review again before applying.",
        preview,
      };
    }
    const patch = workingPatchForRecalcRow(row, entry.timing ?? {
      dayIntent: null,
      dayAnchor: null,
      relativeDayOffset: null,
      dayOffsetOverridden: false,
      templateDayOffset: null,
      templateDayAnchor: null,
      fixedDate: null,
      clockIntent: null,
      relativeMinutes: null,
      clockOverridden: false,
      attention: null,
    });
    if (!patch) continue;
    const write: TimingWrite = {
      ...patch.timing,
      dayOffset: patch.dayOffset,
      entryTime: patch.entryTime,
    };
    updates.push({
      id: row.entryId,
      day_offset: patch.dayOffset,
      entry_time: patch.entryTime,
      timing: timingDbColumns(write),
    });
  }

  const { data, error } = await supabase.rpc("apply_venue_timeline_timing_recalc", {
    p_event_id: input.eventId,
    p_updates: updates.map((u) => ({
      id: u.id,
      day_offset: u.day_offset,
      entry_time: u.entry_time,
      ...u.timing,
    })),
  });
  if (error) {
    return { ok: false, message: error.message || "Could not update timeline items." };
  }
  const row = data as { ok?: boolean; applied?: number; error?: string; message?: string } | null;
  if (!row || row.ok !== true) {
    return {
      ok: false,
      error: row?.error,
      message: row?.message ?? "Could not update timeline items.",
    };
  }
  return { ok: true, applied: Number(row.applied ?? updates.length), fingerprint: preview.fingerprint };
}
