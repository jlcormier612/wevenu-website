/**
 * Floor Plan Templates application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/floor-plan-templates/repository";
import { parsePastedLayout } from "@/lib/floor-plan-templates/paste-parse";
import type {
  CreateFloorPlanTemplateResult,
  FloorPlanTemplate,
  FloorPlanTemplateActionResult,
  FloorPlanTemplateObject,
  FloorPlanTemplateWithStats,
  ImportFloorPlanTemplateResult,
} from "@/lib/floor-plan-templates/types";
import type {
  AddObjectInput, FloorPlanActionResult, ReorderDirection, UpdateObjectInput, UpdateRoomSettingsInput,
} from "@/lib/floor-plans/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | FloorPlanTemplateActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

// ---- Templates ---------------------------------------------------------------

export async function getTemplates(): Promise<FloorPlanTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id);
}

export async function getTemplate(id: string): Promise<FloorPlanTemplate | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplate(await createClient(), venue.id, id);
}

// The Floor Plan Template Library page — every template including archived,
// with object counts and space names for the card grid.
export async function getTemplatesForLibrary(): Promise<FloorPlanTemplateWithStats[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplatesWithStats(await createClient(), venue.id);
}

export async function createTemplate(name: string, eventType: string | null, spaceId: string | null, isDefault?: boolean): Promise<CreateFloorPlanTemplateResult> {
  if (!name.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.insertTemplate(supabase, venueId, name, eventType, spaceId);
    if (isDefault) await repo.setTemplateDefault(supabase, venueId, templateId, eventType, spaceId);
    return { ok: true, templateId } as CreateFloorPlanTemplateResult;
  });
  return result as CreateFloorPlanTemplateResult;
}

export async function renameTemplate_(id: string, name: string): Promise<FloorPlanTemplateActionResult> {
  if (!name.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.renameTemplate(supabase, venueId, id, name);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}

export async function setTemplateDefault_(id: string): Promise<FloorPlanTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const template = await repo.getTemplate(supabase, venueId, id);
    if (!template) return { ok: false, message: "Template not found." } as FloorPlanTemplateActionResult;
    await repo.setTemplateDefault(supabase, venueId, id, template.eventType, template.spaceId);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}

export async function setTemplateArchived_(id: string, isArchived: boolean): Promise<FloorPlanTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setTemplateArchived(supabase, venueId, id, isArchived);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}

export async function duplicateTemplate(sourceTemplateId: string, newName: string, isDefault?: boolean): Promise<CreateFloorPlanTemplateResult> {
  if (!newName.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.duplicateTemplateInto(supabase, venueId, sourceTemplateId, newName);
    if (isDefault) {
      const template = await repo.getTemplate(supabase, venueId, templateId);
      if (template) await repo.setTemplateDefault(supabase, venueId, templateId, template.eventType, template.spaceId);
    }
    return { ok: true, templateId } as CreateFloorPlanTemplateResult;
  });
  return result as CreateFloorPlanTemplateResult;
}

/** "Paste Layout Details" — creates a template and populates it from pasted text. See paste-parse.ts. */
export async function createTemplateFromPaste(
  rawText: string, name: string, eventType: string | null, spaceId: string | null, isDefault?: boolean,
): Promise<ImportFloorPlanTemplateResult> {
  const items = parsePastedLayout(rawText);
  if (items.length === 0) return { ok: false, message: "There's no text to work with — paste your layout first." };

  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.insertTemplate(supabase, venueId, name, eventType, spaceId);
    for (const item of items) {
      await repo.insertObject(supabase, venueId, templateId, item);
    }
    if (isDefault) await repo.setTemplateDefault(supabase, venueId, templateId, eventType, spaceId);
    return { ok: true, templateId, objectCount: items.length } as ImportFloorPlanTemplateResult;
  });
  return result as ImportFloorPlanTemplateResult;
}

// ---- Objects ---------------------------------------------------------------

export async function getObjects(templateId: string): Promise<FloorPlanTemplateObject[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getObjects(await createClient(), venue.id, templateId);
}

export async function addObject(templateId: string, input: AddObjectInput): Promise<{ ok: true; object: FloorPlanTemplateObject } | FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const object = await repo.insertObject(supabase, venueId, templateId, input);
    return { ok: true, object };
  });
  return result as { ok: true; object: FloorPlanTemplateObject } | FloorPlanActionResult;
}

export async function updateObject_(objId: string, input: UpdateObjectInput): Promise<FloorPlanTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateObject(supabase, venueId, objId, input);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}

export async function deleteObject_(objId: string): Promise<FloorPlanTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteObject(supabase, venueId, objId);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}

export async function clearTemplate(templateId: string): Promise<FloorPlanTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.clearObjects(supabase, venueId, templateId);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}

export async function updateBackground(templateId: string, url: string | null, opacity: number): Promise<FloorPlanTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateBackground(supabase, venueId, templateId, url, opacity);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}

export async function setBackgroundLocked(templateId: string, locked: boolean): Promise<FloorPlanTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setBackgroundLocked(supabase, venueId, templateId, locked);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}

export async function updateRoomSettings(templateId: string, input: UpdateRoomSettingsInput): Promise<FloorPlanTemplateActionResult> {
  if (input.roomWidthFt <= 0 || input.roomDepthFt <= 0) return { ok: false, message: "Room dimensions must be greater than zero." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateRoomSettings(supabase, venueId, templateId, input);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}

export async function reorderObject(templateId: string, objId: string, direction: ReorderDirection): Promise<FloorPlanTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reorderObject(supabase, venueId, templateId, objId, direction);
    return { ok: true } as FloorPlanTemplateActionResult;
  });
  return result as FloorPlanTemplateActionResult;
}
