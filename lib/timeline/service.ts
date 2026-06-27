/**
 * Timeline application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { TIMELINE_TEMPLATES } from "@/lib/timeline/constants";
import * as repo from "@/lib/timeline/repository";
import type {
  AddEntryResult,
  TimelineActionResult,
  TimelineEntry,
  TimelineEntryInput,
} from "@/lib/timeline/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | TimelineActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getTimelineEntries(eventId: string): Promise<TimelineEntry[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTimelineEntries(await createClient(), venue.id, eventId);
}

export async function addEntry(eventId: string, input: TimelineEntryInput): Promise<AddEntryResult> {
  if (!input.title.trim()) return { ok: false, errors: { title: "Title is required." } };
  const result = await withVenue(async (supabase, venueId) => {
    const entry = await repo.insertEntry(supabase, venueId, eventId, input);
    return { ok: true, entry } as AddEntryResult;
  });
  return result as AddEntryResult;
}

export async function updateEntry(entryId: string, input: TimelineEntryInput): Promise<TimelineActionResult> {
  if (!input.title.trim()) return { ok: false, errors: { title: "Title is required." } };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateEntry(supabase, venueId, entryId, input);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

export async function deleteEntry(entryId: string): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteEntry(supabase, venueId, entryId);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

export async function reorderEntry(
  eventId: string, entryId: string, direction: "up" | "down",
): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reorderEntry(supabase, venueId, eventId, entryId, direction);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

export async function applyTemplate(
  eventId: string, templateId: string, eventStartTime: string | null,
): Promise<TimelineActionResult> {
  const template = TIMELINE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return { ok: false, message: "Template not found." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.applyTemplate(supabase, venueId, eventId, template, eventStartTime);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}
