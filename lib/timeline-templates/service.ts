import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { proposeTimelineDraft } from "@/lib/luv/timeline-import";
import * as repo from "@/lib/timeline-templates/repository";
import type {
  CreateTimelineTemplateResult,
  ImportTimelineTemplateResult,
  TimelineTemplate,
  TimelineTemplateActionResult,
  TimelineTemplateItem,
  TimelineTemplateItemInput,
  TimelineTemplateWithStats,
} from "@/lib/timeline-templates/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(fn: (c: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>): Promise<T | TimelineTemplateActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  return fn(supabase, venue.id);
}

// ---- Templates ---------------------------------------------------------------

export async function getTemplates(): Promise<TimelineTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id);
}

// The Timeline Template Library page — every template including archived,
// with item counts and space names for the card grid.
export async function getTemplatesForLibrary(): Promise<TimelineTemplateWithStats[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplatesWithStats(await createClient(), venue.id);
}

export async function getTemplate(id: string): Promise<TimelineTemplate | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplate(await createClient(), venue.id, id);
}

export async function createTemplate(name: string, eventType: string | null, spaceId: string | null): Promise<CreateTimelineTemplateResult> {
  if (!name.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (c, venueId) => {
    const templateId = await repo.insertTemplate(c, venueId, name, eventType, spaceId);
    return { ok: true, templateId } as CreateTimelineTemplateResult;
  });
  return result as CreateTimelineTemplateResult;
}

export async function renameTemplate_(id: string, name: string): Promise<TimelineTemplateActionResult> {
  if (!name.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (c, venueId) => {
    await repo.renameTemplate(c, venueId, id, name);
    return { ok: true } as TimelineTemplateActionResult;
  });
  return result as TimelineTemplateActionResult;
}

export async function setTemplateDefault_(id: string): Promise<TimelineTemplateActionResult> {
  const result = await withVenue(async (c, venueId) => {
    const template = await repo.getTemplate(c, venueId, id);
    if (!template) return { ok: false, message: "Template not found." } as TimelineTemplateActionResult;
    await repo.setTemplateDefault(c, venueId, id, template.eventType, template.spaceId);
    return { ok: true } as TimelineTemplateActionResult;
  });
  return result as TimelineTemplateActionResult;
}

export async function setTemplateArchived_(id: string, isArchived: boolean): Promise<TimelineTemplateActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.setTemplateArchived(c, venueId, id, isArchived);
    return { ok: true } as TimelineTemplateActionResult;
  });
  return result as TimelineTemplateActionResult;
}

export async function duplicateTemplate(sourceTemplateId: string, newName: string): Promise<CreateTimelineTemplateResult> {
  if (!newName.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (c, venueId) => {
    const source = await repo.getTemplate(c, venueId, sourceTemplateId);
    if (!source) return { ok: false, message: "Template not found." } as CreateTimelineTemplateResult;
    const templateId = await repo.duplicateTemplateInto(c, venueId, sourceTemplateId, newName);
    return { ok: true, templateId } as CreateTimelineTemplateResult;
  });
  return result as CreateTimelineTemplateResult;
}

export async function createTemplateFromImport(rawText: string, name: string, eventType: string | null, spaceId: string | null): Promise<ImportTimelineTemplateResult> {
  const proposal = await proposeTimelineDraft(rawText);
  if (!proposal.ok) return { ok: false, message: proposal.message };

  const result = await withVenue(async (c, venueId) => {
    const templateId = await repo.insertTemplate(c, venueId, name, eventType, spaceId);
    let guessedCount = 0;
    for (let i = 0; i < proposal.items.length; i++) {
      const item = proposal.items[i];
      if (item.guessed) guessedCount++;
      await repo.insertItem(c, venueId, templateId, {
        title: item.title, description: item.description || null, notes: null,
        timeOfDay: null, minutesOffset: item.minutesOffset, audiences: ["internal"], sortOrder: i,
      });
    }
    return { ok: true, templateId, itemCount: proposal.items.length, guessedCount } as ImportTimelineTemplateResult;
  });
  return result as ImportTimelineTemplateResult;
}

// ---- Items ---------------------------------------------------------------

export async function getItems(templateId: string): Promise<TimelineTemplateItem[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getItems(await createClient(), venue.id, templateId);
}

export async function addItem(templateId: string, input: TimelineTemplateItemInput): Promise<TimelineTemplateActionResult & { itemId?: string }> {
  const result = await withVenue(async (c, venueId) => {
    const itemId = await repo.insertItem(c, venueId, templateId, input);
    return { ok: true, itemId } as TimelineTemplateActionResult & { itemId?: string };
  });
  return result as TimelineTemplateActionResult & { itemId?: string };
}

export async function updateItem_(itemId: string, patch: Partial<TimelineTemplateItemInput>): Promise<TimelineTemplateActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateItem(c, venueId, itemId, patch);
    return { ok: true } as TimelineTemplateActionResult;
  });
  return result as TimelineTemplateActionResult;
}

export async function deleteItem_(itemId: string): Promise<TimelineTemplateActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.deleteItem(c, venueId, itemId);
    return { ok: true } as TimelineTemplateActionResult;
  });
  return result as TimelineTemplateActionResult;
}

export async function reorderItems_(orderedItemIds: string[]): Promise<TimelineTemplateActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.reorderItems(c, venueId, orderedItemIds);
    return { ok: true } as TimelineTemplateActionResult;
  });
  return result as TimelineTemplateActionResult;
}
