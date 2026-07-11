/**
 * Timeline application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { TIMELINE_TEMPLATES } from "@/lib/timeline/constants";
import * as repo from "@/lib/timeline/repository";
import type {
  AddAttachmentResult,
  AddEntryResult,
  AddLinkResult,
  AddRelatedLinkResult,
  AddSectionResult,
  DuplicateSectionResult,
  TimelineActionResult,
  TimelineEntry,
  TimelineEntryAttachment,
  TimelineEntryInput,
  TimelineEntryLink,
  TimelineEntryStatus,
  TimelineRelatedLink,
  TimelineRelatedSourceType,
  TimelineSection,
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

// ---- Entries -------------------------------------------------------------------

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

export async function setEntryStatus(entryId: string, status: TimelineEntryStatus): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setEntryStatus(supabase, venueId, entryId, status);
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

export async function reorderEntries(
  updates: { id: string; sectionId: string | null; sortOrder: number }[],
): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reorderEntries(supabase, venueId, updates);
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

// ---- Sections ------------------------------------------------------------------

export async function getSections(eventId: string): Promise<TimelineSection[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getSections(await createClient(), venue.id, eventId);
}

export async function addSection(eventId: string, name: string, sortOrder: number): Promise<AddSectionResult> {
  if (!name.trim()) return { ok: false, message: "Section name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const section = await repo.insertSection(supabase, venueId, eventId, name, sortOrder);
    return { ok: true, section } as AddSectionResult;
  });
  return result as AddSectionResult;
}

export async function renameSection(sectionId: string, name: string): Promise<TimelineActionResult> {
  if (!name.trim()) return { ok: false, message: "Section name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.renameSection(supabase, venueId, sectionId, name);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

export async function setSectionClientCanAdd(sectionId: string, clientCanAdd: boolean): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setSectionClientCanAdd(supabase, venueId, sectionId, clientCanAdd);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

export async function deleteSection(sectionId: string): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteSection(supabase, venueId, sectionId);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

export async function duplicateSection(eventId: string, sourceSectionId: string, sortOrder: number): Promise<DuplicateSectionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const { section, entries } = await repo.duplicateSection(supabase, venueId, eventId, sourceSectionId, sortOrder);
    return { ok: true, section, entries } as DuplicateSectionResult;
  });
  return result as DuplicateSectionResult;
}

export async function reorderSections(orderedSectionIds: string[]): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reorderSections(supabase, venueId, orderedSectionIds);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

// ---- Links -----------------------------------------------------------------

export async function getEntryLinksForEvent(eventId: string): Promise<Record<string, TimelineEntryLink[]>> {
  if (!isSupabaseConfigured) return {};
  const venue = await getCurrentVenue();
  if (!venue) return {};
  return repo.getEntryLinksForEvent(await createClient(), venue.id, eventId);
}

export async function addEntryLink(timelineEntryId: string, url: string, label: string | null, sortOrder: number): Promise<AddLinkResult> {
  if (!url.trim()) return { ok: false, message: "A URL is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const link = await repo.addEntryLink(supabase, venueId, timelineEntryId, url, label, sortOrder);
    return { ok: true, link } as AddLinkResult;
  });
  return result as AddLinkResult;
}

export async function removeEntryLink(linkId: string): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeEntryLink(supabase, venueId, linkId);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

// ---- Attachments -----------------------------------------------------------

export async function getEntryAttachmentsForEvent(eventId: string): Promise<Record<string, TimelineEntryAttachment[]>> {
  if (!isSupabaseConfigured) return {};
  const venue = await getCurrentVenue();
  if (!venue) return {};
  return repo.getEntryAttachmentsForEvent(await createClient(), venue.id, eventId);
}

export async function addEntryAttachment(timelineEntryId: string, documentId: string, sortOrder: number): Promise<AddAttachmentResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const attachment = await repo.addEntryAttachment(supabase, venueId, timelineEntryId, documentId, sortOrder);
    return { ok: true, attachment } as AddAttachmentResult;
  });
  return result as AddAttachmentResult;
}

export async function removeEntryAttachment(attachmentId: string): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeEntryAttachment(supabase, venueId, attachmentId);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

// ---- Related Items (Timeline Integration) ---------------------------------

export async function getRelatedLinksForEvent(eventId: string): Promise<Record<string, TimelineRelatedLink[]>> {
  if (!isSupabaseConfigured) return {};
  const venue = await getCurrentVenue();
  if (!venue) return {};
  return repo.getRelatedLinksForEvent(await createClient(), venue.id, eventId);
}

export async function addPlanningLink(timelineEntryId: string, taskId: string): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.addPlanningLink(supabase, venueId, timelineEntryId, taskId);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

export async function removePlanningLink(linkId: string): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removePlanningLink(supabase, venueId, linkId);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}

export async function addRelatedLink(
  timelineEntryId: string, sourceType: Exclude<TimelineRelatedSourceType, "planning_task">, sourceId: string,
): Promise<AddRelatedLinkResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const link = await repo.addRelatedLink(supabase, venueId, timelineEntryId, sourceType, sourceId);
    return { ok: true, link } as AddRelatedLinkResult;
  });
  return result as AddRelatedLinkResult;
}

export async function removeRelatedLink(linkId: string): Promise<TimelineActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeRelatedLink(supabase, venueId, linkId);
    return { ok: true } as TimelineActionResult;
  });
  return result as TimelineActionResult;
}
