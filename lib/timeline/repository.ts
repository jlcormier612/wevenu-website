/**
 * Timeline data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import {
  minutesToTime,
  timeToMinutes,
  type TimelineTemplate,
} from "@/lib/timeline/constants";
import type { TimelineEntry, TimelineEntryInput } from "@/lib/timeline/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type EntryRow = {
  id: string; venue_id: string; event_id: string;
  title: string; description: string | null;
  entry_time: string | null; sort_order: number;
  created_at: string; updated_at: string;
};

function mapEntry(r: EntryRow): TimelineEntry {
  return {
    id: r.id, venueId: r.venue_id, eventId: r.event_id,
    title: r.title, description: r.description,
    entryTime: r.entry_time?.slice(0, 5) ?? null,
    sortOrder: r.sort_order,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Canonical sort: time ASC (nulls last), then sort_order, then created_at. */
export async function getTimelineEntries(
  client: DbClient, venueId: string, eventId: string,
): Promise<TimelineEntry[]> {
  const { data, error } = await client
    .from("timeline_entries").select("*")
    .eq("event_id", eventId).eq("venue_id", venueId)
    .order("entry_time", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as EntryRow[]).map(mapEntry);
}

export async function insertEntry(
  client: DbClient, venueId: string, eventId: string, input: TimelineEntryInput,
): Promise<TimelineEntry> {
  const { data, error } = await client.from("timeline_entries")
    .insert({
      venue_id: venueId, event_id: eventId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      entry_time: input.entryTime || null,
      sort_order: 0,
    })
    .select().single<EntryRow>();
  if (error) throw error;
  return mapEntry(data);
}

export async function updateEntry(
  client: DbClient, venueId: string, entryId: string, input: TimelineEntryInput,
): Promise<void> {
  const { error } = await client.from("timeline_entries")
    .update({
      title: input.title.trim(),
      description: input.description.trim() || null,
      entry_time: input.entryTime || null,
    })
    .eq("id", entryId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteEntry(
  client: DbClient, venueId: string, entryId: string,
): Promise<void> {
  const { error } = await client.from("timeline_entries")
    .delete().eq("id", entryId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Move an entry up or down within the same entry_time group.
 * Swaps the sort_order of the target and its neighbour.
 */
export async function reorderEntry(
  client: DbClient, venueId: string, eventId: string,
  entryId: string, direction: "up" | "down",
): Promise<void> {
  const { data, error } = await client
    .from("timeline_entries").select("id, entry_time, sort_order")
    .eq("event_id", eventId).eq("venue_id", venueId)
    .order("entry_time", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const entries = data as { id: string; entry_time: string | null; sort_order: number }[];

  const idx = entries.findIndex((e) => e.id === entryId);
  if (idx === -1) return;

  const neighbourIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighbourIdx < 0 || neighbourIdx >= entries.length) return;

  const current = entries[idx];
  const neighbour = entries[neighbourIdx];
  // Only swap within the same time group
  if (current.entry_time !== neighbour.entry_time) return;

  await Promise.all([
    client.from("timeline_entries").update({ sort_order: neighbour.sort_order }).eq("id", current.id),
    client.from("timeline_entries").update({ sort_order: current.sort_order }).eq("id", neighbour.id),
  ]);
}

/**
 * Apply a timeline template to an event, computing absolute times from
 * the event's start_time. If start_time is null, noon (12:00) is used.
 * Appends to any existing entries — does not replace them.
 */
export async function applyTemplate(
  client: DbClient, venueId: string, eventId: string,
  template: TimelineTemplate, startTime: string | null,
): Promise<void> {
  const baseMinutes = startTime ? timeToMinutes(startTime.slice(0, 5)) : 12 * 60;

  const rows = template.entries.map((te, i) => {
    const totalMinutes = baseMinutes + te.minutesOffset;
    const inRange = totalMinutes >= 0 && totalMinutes < 24 * 60;
    return {
      venue_id: venueId,
      event_id: eventId,
      title: te.title,
      description: te.description ?? null,
      entry_time: inRange ? minutesToTime(totalMinutes) : null,
      sort_order: i,
    };
  });

  const { error } = await client.from("timeline_entries").insert(rows);
  if (error) throw error;
}
