/**
 * Operational timeline cutover — venue-owned timeline_entries only.
 * Proximity / finalized / explicit force decide whether to import (A) or skip (B).
 */

import type { createClient } from "@/integrations/supabase/server";
import { resolveEventForMigration } from "@/lib/migration/resolve-refs";
import * as timelineRepo from "@/lib/timeline/repository";
import type { TimelineAudience, TimelineEntryStatus, TimelineLockState } from "@/lib/timeline/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export const TIMELINE_PROXIMITY_DAYS = 21;

export type NormalizedTimelineEntry = {
  eventId?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  eventDate?: string | null;
  title: string;
  description?: string | null;
  notes?: string | null;
  entryTime?: string | null;
  endTime?: string | null;
  dayOffset?: string | null;
  audiences?: string | null;
  status?: string | null;
  lockState?: string | null;
  /** Source says day-of timeline is finalized / locked. */
  timelineFinalized?: boolean;
  /** Coordinator explicitly chose to import the live timeline. */
  forceImport?: boolean;
  sortOrder?: string | null;
  sourceId?: string | null;
};

export type TimelineDecision =
  | { import: true; reason: "within_proximity" | "finalized" | "forced" }
  | { import: false; reason: "not_operational" };

export function shouldImportOperationalTimeline(opts: {
  eventDate: string | null;
  timelineFinalized?: boolean;
  forceImport?: boolean;
  today?: string;
}): TimelineDecision {
  if (opts.forceImport) return { import: true, reason: "forced" };
  if (opts.timelineFinalized) return { import: true, reason: "finalized" };
  if (!opts.eventDate) return { import: false, reason: "not_operational" };
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  if (opts.eventDate < today) return { import: false, reason: "not_operational" };
  const start = new Date(`${today}T12:00:00Z`).getTime();
  const event = new Date(`${opts.eventDate}T12:00:00Z`).getTime();
  const days = Math.round((event - start) / (24 * 60 * 60 * 1000));
  if (days >= 0 && days <= TIMELINE_PROXIMITY_DAYS) {
    return { import: true, reason: "within_proximity" };
  }
  return { import: false, reason: "not_operational" };
}

export function validateTimelineEntry(n: NormalizedTimelineEntry): string | null {
  if (!n.title?.trim()) return "Timeline entry title is required.";
  if (!n.eventId?.trim() && !n.clientEmail?.trim() && !n.clientId?.trim()) {
    return "Timeline rows need eventId, or client email / client id (with eventDate).";
  }
  return null;
}

function parseAudiences(raw: string | null | undefined): TimelineAudience[] {
  if (!raw?.trim()) return ["venue"];
  const parts = raw.split(/[,|;]/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  const allowed: TimelineAudience[] = ["venue", "client", "wedding_party", "vendors"];
  const next = parts.filter((p): p is TimelineAudience => (allowed as string[]).includes(p));
  return next.length ? next : ["venue"];
}

async function findExistingEntry(
  client: DbClient,
  venueId: string,
  eventId: string,
  n: NormalizedTimelineEntry,
): Promise<string | null> {
  if (n.sourceId?.trim()) {
    const marker = `[migration:${n.sourceId.trim()}]`;
    const { data } = await client.from("timeline_entries")
      .select("id")
      .eq("venue_id", venueId)
      .eq("event_id", eventId)
      .ilike("notes", `%${marker}%`)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (data?.id) return data.id;
  }
  const title = n.title.trim().toLowerCase();
  const time = n.entryTime?.trim()?.slice(0, 5) || null;
  const dayOffset = n.dayOffset != null && n.dayOffset !== "" ? Number(n.dayOffset) : 0;
  const { data: rows } = await client.from("timeline_entries")
    .select("id, title, entry_time, day_offset")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .eq("owner", "venue");
  for (const row of (rows ?? []) as { id: string; title: string; entry_time: string | null; day_offset: number }[]) {
    if (row.title.trim().toLowerCase() !== title) continue;
    if ((row.day_offset ?? 0) !== (Number.isFinite(dayOffset) ? dayOffset : 0)) continue;
    const rowTime = row.entry_time?.slice(0, 5) ?? null;
    if (rowTime !== time) continue;
    return row.id;
  }
  return null;
}

export type TimelineCommitResult =
  | { ok: true; entryId: string | null; skipped?: boolean; skipReason?: string; alreadyExisted?: boolean; eventId: string }
  | { ok: false; error: string };

/**
 * Import one venue-owned timeline entry when the proximity / finalized / force
 * rule says the day-of timeline is operationally live. Otherwise skip (B).
 */
export async function commitOperationalTimelineEntry(
  client: DbClient,
  venueId: string,
  n: NormalizedTimelineEntry,
): Promise<TimelineCommitResult> {
  const validationError = validateTimelineEntry(n);
  if (validationError) return { ok: false, error: validationError };

  const resolved = await resolveEventForMigration(client, venueId, n);
  if (!resolved.ok) return resolved;

  const decision = shouldImportOperationalTimeline({
    eventDate: resolved.eventDate,
    timelineFinalized: !!n.timelineFinalized,
    forceImport: !!n.forceImport,
  });
  if (!decision.import) {
    return {
      ok: true,
      entryId: null,
      skipped: true,
      skipReason: "Event is more than 21 days out and timeline is not finalized — recreate in HTC when ready.",
      eventId: resolved.eventId,
    };
  }

  const existingId = await findExistingEntry(client, venueId, resolved.eventId, n);
  if (existingId) {
    return { ok: true, entryId: existingId, alreadyExisted: true, eventId: resolved.eventId };
  }

  const lockState: TimelineLockState =
    n.lockState === "editable" ? "editable" : "locked";
  const statusRaw = (n.status?.trim().toLowerCase() ?? "not_started") as TimelineEntryStatus;
  const status: TimelineEntryStatus =
    statusRaw === "in_progress" || statusRaw === "complete" ? statusRaw : "not_started";

  const noteParts = [
    n.notes?.trim() || "",
    n.sourceId?.trim() ? `[migration:${n.sourceId.trim()}]` : "",
    `Imported via Bring Your Business (${decision.reason}).`,
  ].filter(Boolean);

  const entry = await timelineRepo.insertEntry(client, venueId, resolved.eventId, {
    title: n.title.trim(),
    description: n.description?.trim() ?? "",
    notes: noteParts.join("\n"),
    entryTime: n.entryTime?.trim()?.slice(0, 5) ?? "",
    dayOffset: n.dayOffset != null && n.dayOffset !== "" ? Number(n.dayOffset) : 0,
    audiences: parseAudiences(n.audiences),
    lockState,
    status,
    sortOrder: n.sortOrder != null && n.sortOrder !== "" ? Number(n.sortOrder) : 0,
  });

  return { ok: true, entryId: entry.id, eventId: resolved.eventId };
}
