/**
 * Event Order Templates application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  parseTemplateOfferingWrite,
  validateSectionName,
} from "@/lib/event-order-templates/offerings";
import * as repo from "@/lib/event-order-templates/repository";
import type { TemplateLineWrite } from "@/lib/event-order-templates/repository";
import type {
  AddTemplateLineInput, AddTemplateLineResult, AddTemplateSectionResult,
  CreateEventOrderTemplateResult, EventOrderTemplate, EventOrderTemplateActionResult,
  EventOrderTemplateInput, EventOrderTemplateWithDetails, UpdateTemplateLineInput,
} from "@/lib/event-order-templates/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | EventOrderTemplateActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

function validateInput(input: EventOrderTemplateInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "Give this template a name.";
  return errors;
}

function parseLineWrite(input: AddTemplateLineInput): { ok: true; write: TemplateLineWrite } | { ok: false; errors: Record<string, string> } {
  return parseTemplateOfferingWrite(input);
}

// ---- reads --------------------------------------------------------------------

export async function getTemplates(includeArchived = false): Promise<EventOrderTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id, includeArchived);
}

export async function getTemplate(id: string): Promise<EventOrderTemplateWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplateWithDetails(await createClient(), venue.id, id);
}

// ---- template CRUD --------------------------------------------------------------

export async function createTemplate(input: EventOrderTemplateInput): Promise<CreateEventOrderTemplateResult> {
  const errors = validateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.insertTemplate(supabase, venueId, input);
    return { ok: true, templateId } as CreateEventOrderTemplateResult;
  });
  return result as CreateEventOrderTemplateResult;
}

export async function updateTemplate_(id: string, input: EventOrderTemplateInput): Promise<EventOrderTemplateActionResult> {
  const errors = validateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateTemplate(supabase, venueId, id, input);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function setTemplateArchived_(id: string, isArchived: boolean): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setTemplateArchived(supabase, venueId, id, isArchived);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function deleteTemplate_(id: string): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => repo.deleteTemplate(supabase, venueId, id));
  return result as EventOrderTemplateActionResult;
}

export async function duplicateTemplate_(id: string, newName: string): Promise<CreateEventOrderTemplateResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.duplicateTemplate(supabase, venueId, id, newName);
    return { ok: true, templateId } as CreateEventOrderTemplateResult;
  });
  return result as CreateEventOrderTemplateResult;
}

// ---- sections ---------------------------------------------------------------------

export async function addSection(
  templateId: string, name: string, guidance: string | null = null,
): Promise<AddTemplateSectionResult> {
  const nameError = validateSectionName(name);
  if (nameError) return { ok: false, message: nameError };
  const result = await withVenue(async (supabase, venueId) => {
    const sortOrder = await repo.nextSortOrder(supabase, "event_order_template_sections", templateId);
    const section = await repo.insertSection(supabase, venueId, templateId, name, sortOrder, guidance);
    return { ok: true, section } as AddTemplateSectionResult;
  });
  return result as AddTemplateSectionResult;
}

export async function updateSection(
  sectionId: string, input: { name?: string; guidance?: string | null },
): Promise<EventOrderTemplateActionResult> {
  if (input.name !== undefined) {
    const nameError = validateSectionName(input.name);
    if (nameError) return { ok: false, message: nameError };
  }
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateSection(supabase, venueId, sectionId, input);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function updateSectionGuidance(
  sectionId: string, guidance: string | null,
): Promise<EventOrderTemplateActionResult> {
  return updateSection(sectionId, { guidance });
}

export async function reorderSections(
  orderedIds: string[],
): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reorderRows(supabase, "event_order_template_sections", venueId, orderedIds);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function removeSection(sectionId: string): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeSection(supabase, venueId, sectionId);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

// ---- offerings / lines ----------------------------------------------------------

export async function addLine(templateId: string, input: AddTemplateLineInput): Promise<AddTemplateLineResult> {
  const parsed = parseLineWrite(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = await withVenue(async (supabase, venueId) => {
    const sortOrder = await repo.nextSortOrder(
      supabase, "event_order_template_lines", templateId, parsed.write.sectionId,
    );
    const line = await repo.insertLine(supabase, venueId, templateId, parsed.write, sortOrder);
    return { ok: true, line } as AddTemplateLineResult;
  });
  return result as AddTemplateLineResult;
}

export async function updateLine(
  lineId: string, input: UpdateTemplateLineInput,
): Promise<EventOrderTemplateActionResult> {
  const parsed = parseLineWrite(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateLine(supabase, venueId, lineId, parsed.write);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function reorderLines(
  orderedIds: string[],
): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reorderRows(supabase, "event_order_template_lines", venueId, orderedIds);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function removeLine(lineId: string): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeLine(supabase, venueId, lineId);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}
