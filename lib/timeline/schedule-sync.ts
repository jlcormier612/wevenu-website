/**
 * Booked component schedule → timeline activities.
 *
 * Source of truth for times/spaces remains event_space_assignments.
 * Generated timeline rows are tagged with source_space_use_key (stable across
 * replace_event_space_assignments id churn). Manual timeline rows stay null.
 */

import type { createClient } from "@/integrations/supabase/server";
import { VENUE_OWNED_DEFAULT_AUDIENCES } from "@/lib/timeline/audience-ownership";
import { clampDayOffset } from "@/lib/timeline/constants";
import {
  timingColumnsForUntypedDisplaySave,
  type TimingClockIntent,
  type TimingDayIntent,
} from "@/lib/timeline/timing-provenance";
import type { TimelineDayAnchor } from "@/lib/timeline/timing-presentation";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type ScheduleAssignmentForTimeline = {
  useKey: string;
  useLabel: string;
  spaceName: string | null;
  startTime: string | null;
  endTime: string | null;
  scheduledDate: string | null;
  sortOrder: number;
};

function asTimeHhMm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(t) ? t : null;
}

/** Calendar-day offset from event_date → scheduled_date. Null when either missing. */
export function dayOffsetForScheduledDate(
  eventDate: string | null | undefined,
  scheduledDate: string | null | undefined,
): number | null {
  const start = (eventDate ?? "").slice(0, 10);
  const day = (scheduledDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

export function spaceDescription(spaceName: string | null | undefined): string | null {
  const name = spaceName?.trim();
  return name ? `Space: ${name}` : null;
}

/**
 * Pure plan of timeline upserts/deletes for tests — no DB.
 * Only components with a scheduled date and start time are materialized.
 */
export function planScheduleTimelineSync(input: {
  eventDate: string | null;
  eventEndDate: string | null;
  assignments: ScheduleAssignmentForTimeline[];
  existing: Array<{
    id: string;
    sourceSpaceUseKey: string | null;
    lockState: string;
  }>;
}): {
  upserts: Array<{
    useKey: string;
    title: string;
    description: string | null;
    entryTime: string;
    endTime: string | null;
    dayOffset: number;
    sortOrder: number;
    existingId: string | null;
    skipContent: boolean;
  }>;
  deleteIds: string[];
} {
  const existingByKey = new Map(
    input.existing
      .filter((e) => e.sourceSpaceUseKey)
      .map((e) => [e.sourceSpaceUseKey!, e]),
  );

  const upserts: Array<{
    useKey: string;
    title: string;
    description: string | null;
    entryTime: string;
    endTime: string | null;
    dayOffset: number;
    sortOrder: number;
    existingId: string | null;
    skipContent: boolean;
  }> = [];

  const activeKeys = new Set<string>();

  for (const a of input.assignments) {
    const useKey = a.useKey.trim();
    if (!useKey) continue;
    const entryTime = asTimeHhMm(a.startTime);
    const offset = dayOffsetForScheduledDate(input.eventDate, a.scheduledDate);
    if (!entryTime || offset == null) continue;

    activeKeys.add(useKey);
    const dayOffset = clampDayOffset(offset, input.eventDate, input.eventEndDate);
    const existing = existingByKey.get(useKey) ?? null;
    upserts.push({
      useKey,
      title: (a.useLabel || useKey).trim(),
      description: spaceDescription(a.spaceName),
      entryTime,
      endTime: asTimeHhMm(a.endTime),
      dayOffset,
      sortOrder: a.sortOrder,
      existingId: existing?.id ?? null,
      skipContent: existing?.lockState === "locked",
    });
  }

  const deleteIds = input.existing
    .filter((e) => e.sourceSpaceUseKey && !activeKeys.has(e.sourceSpaceUseKey))
    .map((e) => e.id);

  return { upserts, deleteIds };
}

function asDayIntent(value: string | null | undefined): TimingDayIntent | null {
  return value === "relative" || value === "fixed" || value === "unknown" ? value : null;
}

function asDayAnchor(value: string | null | undefined): TimelineDayAnchor | null {
  return value === "event_start" || value === "event_end" ? value : null;
}

function asClockIntent(value: string | null | undefined): TimingClockIntent | null {
  return value === "relative" || value === "explicit" || value === "untimed" || value === "unknown"
    ? value
    : null;
}

/**
 * Schedule sync is an untyped display write. It must not invent timing intent
 * or detach a fixed date or wedding-end anchor. New generated rows omit timing.
 */
export function scheduleSyncWriteForExistingRow(
  current: {
    dayIntent: TimingDayIntent | null;
    dayAnchor: TimelineDayAnchor | null;
    clockIntent: TimingClockIntent | null;
    dayOffset: number;
    entryTime: string | null;
  },
  planned: { dayOffset: number; entryTime: string | null },
) {
  return timingColumnsForUntypedDisplaySave(current, planned);
}

export async function syncTimelineFromEventSpaceAssignments(
  client: DbClient,
  venueId: string,
  eventId: string,
): Promise<{ upserted: number; deleted: number; skippedLocked: number }> {
  const { data: event } = await client
    .from("events")
    .select("event_date, event_end_date")
    .eq("id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle<{ event_date: string | null; event_end_date: string | null }>();
  if (!event) return { upserted: 0, deleted: 0, skippedLocked: 0 };

  const { data: assignRows } = await client
    .from("event_space_assignments")
    .select("use_key, use_label, start_time, end_time, scheduled_date, sort_order, space_id, venue_spaces(name)")
    .eq("event_id", eventId)
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });

  const assignments: ScheduleAssignmentForTimeline[] = (assignRows ?? []).map((r) => {
    const row = r as {
      use_key: string;
      use_label: string | null;
      start_time: string | null;
      end_time: string | null;
      scheduled_date: string | null;
      sort_order: number;
      venue_spaces: { name: string | null } | { name: string | null }[] | null;
    };
    const space = Array.isArray(row.venue_spaces) ? row.venue_spaces[0] : row.venue_spaces;
    return {
      useKey: row.use_key,
      useLabel: row.use_label ?? row.use_key,
      spaceName: space?.name ?? null,
      startTime: row.start_time,
      endTime: row.end_time,
      scheduledDate: row.scheduled_date,
      sortOrder: row.sort_order ?? 0,
    };
  });

  const { data: existingRows, error: existingError } = await client
    .from("timeline_entries")
    .select("id, source_space_use_key, lock_state, day_offset, entry_time, timing_day_intent, timing_day_anchor, timing_clock_intent")
    .eq("event_id", eventId)
    .eq("venue_id", venueId)
    .not("source_space_use_key", "is", null);
  if (existingError) throw existingError;

  type ExistingGenerated = {
    id: string;
    source_space_use_key: string | null;
    lock_state: string | null;
    day_offset: number | null;
    entry_time: string | null;
    timing_day_intent: string | null;
    timing_day_anchor: string | null;
    timing_clock_intent: string | null;
  };
  const existing = (existingRows ?? []) as ExistingGenerated[];
  const existingById = new Map(existing.map((row) => [row.id, row]));

  const plan = planScheduleTimelineSync({
    eventDate: event.event_date,
    eventEndDate: event.event_end_date,
    assignments,
    existing: existing.map((r) => ({
      id: r.id,
      sourceSpaceUseKey: r.source_space_use_key,
      lockState: r.lock_state ?? "editable",
    })),
  });

  let upserted = 0;
  let skippedLocked = 0;

  for (const u of plan.upserts) {
    if (u.skipContent && u.existingId) {
      skippedLocked += 1;
      continue;
    }
    const payload = {
      venue_id: venueId,
      event_id: eventId,
      title: u.title,
      description: u.description,
      entry_time: u.entryTime,
      end_time: u.endTime,
      day_offset: u.dayOffset,
      sort_order: u.sortOrder,
      source_space_use_key: u.useKey,
      owner: "venue" as const,
      lock_state: "editable" as const,
      audiences: [...VENUE_OWNED_DEFAULT_AUDIENCES],
      status: "not_started" as const,
    };
    if (u.existingId) {
      const current = existingById.get(u.existingId);
      const decided = current
        ? scheduleSyncWriteForExistingRow(
          {
            dayIntent: asDayIntent(current.timing_day_intent),
            dayAnchor: asDayAnchor(current.timing_day_anchor),
            clockIntent: asClockIntent(current.timing_clock_intent),
            dayOffset: current.day_offset ?? 0,
            entryTime: current.entry_time?.slice(0, 5) ?? null,
          },
          { dayOffset: u.dayOffset, entryTime: u.entryTime },
        )
        : { dayOffset: u.dayOffset, entryTime: u.entryTime, timingColumns: {} };
      const { error } = await client
        .from("timeline_entries")
        .update({
          title: payload.title,
          description: payload.description,
          entry_time: decided.entryTime,
          end_time: payload.end_time,
          day_offset: decided.dayOffset,
          sort_order: payload.sort_order,
          ...decided.timingColumns,
        })
        .eq("id", u.existingId)
        .eq("venue_id", venueId)
        .eq("owner", "venue");
      if (error) throw error;
    } else {
      const { error } = await client.from("timeline_entries").insert(payload);
      if (error) throw error;
    }
    upserted += 1;
  }

  let deleted = 0;
  if (plan.deleteIds.length > 0) {
    const { error, count } = await client
      .from("timeline_entries")
      .delete({ count: "exact" })
      .eq("venue_id", venueId)
      .eq("event_id", eventId)
      .eq("owner", "venue")
      .in("id", plan.deleteIds);
    if (error) throw error;
    deleted = count ?? plan.deleteIds.length;
  }

  return { upserted, deleted, skippedLocked };
}
