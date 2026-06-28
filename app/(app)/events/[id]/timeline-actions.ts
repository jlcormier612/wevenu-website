"use server";

import { revalidatePath } from "next/cache";

import {
  addEntry,
  applyTemplate,
  deleteEntry,
  reorderEntry,
  updateEntry,
} from "@/lib/timeline/service";
import type {
  AddEntryResult,
  TimelineActionResult,
  TimelineEntryInput,
} from "@/lib/timeline/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

async function triggerTimelineAutoComplete(eventId: string) {
  try {
    const { createClient } = await import("@/integrations/supabase/server");
    const { getCurrentVenue } = await import("@/lib/venue/service");
    const { triggerAutoComplete } = await import("@/lib/playbooks/service");
    const [sb, venue] = await Promise.all([createClient(), getCurrentVenue()]);
    if (venue) await triggerAutoComplete(sb, venue.id, eventId, "timeline_created");
  } catch { /* non-blocking */ }
}

export async function addEntryAction(
  eventId: string, input: TimelineEntryInput,
): Promise<AddEntryResult> {
  const result = await addEntry(eventId, input);
  if (result.ok) {
    revalidateEvent(eventId);
    void triggerTimelineAutoComplete(eventId);
  }
  return result;
}

export async function updateEntryAction(
  entryId: string, eventId: string, input: TimelineEntryInput,
): Promise<TimelineActionResult> {
  const result = await updateEntry(entryId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function deleteEntryAction(
  entryId: string, eventId: string,
): Promise<TimelineActionResult> {
  const result = await deleteEntry(entryId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function reorderEntryAction(
  eventId: string, entryId: string, direction: "up" | "down",
): Promise<TimelineActionResult> {
  const result = await reorderEntry(eventId, entryId, direction);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function applyTemplateAction(
  eventId: string, templateId: string, eventStartTime: string | null,
): Promise<TimelineActionResult> {
  const result = await applyTemplate(eventId, templateId, eventStartTime);
  if (result.ok) revalidateEvent(eventId);
  return result;
}
