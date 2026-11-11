/**
 * Booked component schedule → timeline activities.
 *
 * Source of truth for times/spaces remains event_space_assignments.
 * Generated timeline rows are tagged with source_space_use_key (stable across
 * replace_event_space_assignments id churn). Manual timeline rows stay null.
 *
 * Reconciliation plans inside reconcile_timeline_from_schedule after the event
 * row lock. TypeScript helpers below stay for unlock guards and unit tests.
 */

import type { createClient } from "@/integrations/supabase/server";
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
 * The live RPC rebuilds this plan after locking the event row.
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
  /** Unlocked generated rows whose component left the schedule. */
  deleteIds: string[];
  /** Locked generated rows whose component left the schedule — retain, clear the link. */
  detachIds: string[];
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

  const obsolete = input.existing.filter(
    (e) => e.sourceSpaceUseKey && !activeKeys.has(e.sourceSpaceUseKey),
  );
  const deleteIds = obsolete.filter((e) => e.lockState !== "locked").map((e) => e.id);
  const detachIds = obsolete.filter((e) => e.lockState === "locked").map((e) => e.id);

  return { upserts, deleteIds, detachIds };
}

function clockHhMm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(t) ? t : null;
}

/**
 * Shown when the booked schedule persisted and Timeline reconciliation did not.
 * The schedule itself is saved; the venue updates Timeline entries by hand.
 */
export const SCHEDULE_SAVED_TIMELINE_MANUAL_MESSAGE =
  "Your schedule was saved, but the Timeline could not be updated. Please update the corresponding Timeline entries manually to reflect your schedule changes.";

/** Unlock rejected while a linked milestone still differs from the booked schedule. */
export const SCHEDULE_LINKED_UNLOCK_BLOCKED_MESSAGE =
  "This item stays locked because its content differs from the booked schedule. Match the schedule content to unlock, or leave it locked.";

/**
 * Intentional venue content edit of a still-linked milestone: keep
 * source_space_use_key and lock the row so the next reconcile cannot
 * overwrite it or insert a second milestone for the same component.
 * Lock, status, audience, assignee, and reorder-only saves must not call this.
 * Reconciliation must not call this.
 */
export function applyScheduleLinkedContentProtection(patch: Record<string, unknown>): void {
  patch.lock_state = "locked";
  delete patch.source_space_use_key;
}

export type ScheduleLinkedMilestoneContent = {
  title: string;
  description: string | null;
  notes: string | null;
  entryTime: string | null;
  dayOffset: number;
};

/**
 * Expected linked-milestone content for a still-eligible schedule component.
 * Null when the component is not materialized (missing start or scheduled date).
 * Notes are never schedule-generated. End time is schedule-owned and is not
 * part of unlock comparison (the Timeline form cannot edit it).
 */
export function expectedScheduleLinkedContent(input: {
  eventDate: string | null;
  eventEndDate: string | null;
  assignment: ScheduleAssignmentForTimeline;
}): ScheduleLinkedMilestoneContent | null {
  const useKey = input.assignment.useKey.trim();
  if (!useKey) return null;
  const entryTime = asTimeHhMm(input.assignment.startTime);
  const offset = dayOffsetForScheduledDate(input.eventDate, input.assignment.scheduledDate);
  if (!entryTime || offset == null) return null;
  return {
    title: (input.assignment.useLabel || useKey).trim(),
    description: spaceDescription(input.assignment.spaceName),
    notes: null,
    entryTime,
    dayOffset: clampDayOffset(offset, input.eventDate, input.eventEndDate),
  };
}

/**
 * True when venue-editable linked content matches the authoritative schedule.
 * Aligns with scheduleLinkedContentDiverged: title, description, notes, start,
 * and day. End time is omitted — the schedule remains authoritative and the
 * next unlocked reconcile restores it.
 */
export function scheduleLinkedMilestoneMatchesSchedule(
  content: ScheduleLinkedMilestoneContent,
  expected: ScheduleLinkedMilestoneContent,
): boolean {
  return !scheduleLinkedContentDiverged(
    {
      title: expected.title,
      description: expected.description,
      notes: expected.notes,
      entryTime: expected.entryTime,
      dayOffset: expected.dayOffset,
    },
    {
      title: content.title,
      description: content.description,
      notes: content.notes,
      notesProvided: true,
      entryTime: content.entryTime,
      dayOffset: content.dayOffset,
    },
  );
}

/**
 * True when a venue save changes schedule-linked content (title, description,
 * notes, clock, or day). Lock, status, audience, assignee, and reorder-only
 * saves must not lock the row. Reconciliation itself never calls this.
 */
export function scheduleLinkedContentDiverged(
  current: {
    title: string;
    description: string | null;
    notes?: string | null;
    entryTime: string | null;
    dayOffset: number;
  },
  next: {
    title: string;
    description: string | null;
    notes?: string | null;
    notesProvided?: boolean;
    entryTime: string | null;
    dayOffset: number;
  },
): boolean {
  if (current.title.trim() !== next.title.trim()) return true;
  if ((current.description?.trim() || null) !== (next.description?.trim() || null)) return true;
  if (clockHhMm(current.entryTime) !== clockHhMm(next.entryTime)) return true;
  if (current.dayOffset !== next.dayOffset) return true;
  if (next.notesProvided && (current.notes?.trim() || null) !== (next.notes?.trim() || null)) return true;
  return false;
}

/**
 * Schedule sync is an untyped display write. It must not invent timing intent
 * or detach a fixed date or wedding-end anchor. New generated rows omit timing.
 * Live reconcile ports this in SQL; keep the helper for unit tests.
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

/**
 * Reconcile Timeline from the booked schedule. The RPC reads assignments after
 * locking the event row — TypeScript does not supply a plan.
 */
export async function syncTimelineFromEventSpaceAssignments(
  client: DbClient,
  venueId: string,
  eventId: string,
  attempt = 0,
): Promise<{ upserted: number; deleted: number; skippedLocked: number }> {
  const applyOnce = async () => {
    const { data, error } = await client.rpc("reconcile_timeline_from_schedule", {
      p_venue_id: venueId,
      p_event_id: eventId,
    });
    if (error) throw error;
    return (data ?? {}) as {
      upserted?: number;
      deleted?: number;
      detached?: number;
      skippedLocked?: number;
    };
  };

  let applied: { upserted?: number; deleted?: number; detached?: number; skippedLocked?: number };
  try {
    applied = await applyOnce();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
    const unique = /duplicate key|timeline_entries_event_schedule_use_key|23505/i.test(message)
      || code === "23505";
    // One retry after a unique conflict. The RPC rebuilds from current schedule.
    if (!unique || attempt >= 1) throw err;
    return syncTimelineFromEventSpaceAssignments(client, venueId, eventId, attempt + 1);
  }

  return {
    upserted: applied.upserted ?? 0,
    deleted: applied.deleted ?? 0,
    skippedLocked: applied.skippedLocked ?? 0,
  };
}
