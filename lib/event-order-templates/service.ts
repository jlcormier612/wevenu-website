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
  AddTemplateGroupInput, AddTemplateGroupResult, AddTemplateLineInput, AddTemplateLineResult,
  AddTemplateOptionInput, AddTemplateOptionResult, AddTemplateSectionResult,
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

// ---- choice groups / options ----------------------------------------------------

function parseGroupWrite(input: AddTemplateGroupInput): {
  ok: true; write: repo.TemplateGroupWrite;
} | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "Give this choice group a name.";
  if (input.minSelect < 0) errors.minSelect = "Minimum cannot be negative.";
  if (input.maxSelect != null && input.maxSelect < input.minSelect) {
    errors.maxSelect = "Maximum must be at least the minimum.";
  }
  if (input.selectionMode === "single" && input.maxSelect != null && input.maxSelect > 1) {
    errors.maxSelect = "Single-select groups allow at most one option.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    write: {
      sectionId: input.sectionId,
      name: input.name.trim(),
      instructions: input.instructions?.trim() || null,
      selectionMode: input.selectionMode,
      minSelect: input.minSelect,
      maxSelect: input.selectionMode === "single" ? (input.maxSelect ?? 1) : input.maxSelect,
      allowQuantity: input.allowQuantity,
    },
  };
}

function parseOptionWrite(input: AddTemplateOptionInput): {
  ok: true; write: repo.TemplateOptionWrite;
} | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input.label.trim()) errors.label = "Give this option a label.";
  if (!input.groupId) errors.groupId = "Choose a choice group.";
  let unitPrice: number | null = null;
  if (input.isIncluded) {
    unitPrice = 0;
  } else if (input.unitPrice != null && String(input.unitPrice).trim() !== "") {
    const n = Number(input.unitPrice);
    if (!Number.isFinite(n) || n < 0) errors.unitPrice = "Enter a valid price.";
    else unitPrice = n;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    write: {
      groupId: input.groupId,
      offeringId: input.offeringId ?? null,
      label: input.label.trim(),
      description: input.description?.trim() || null,
      isIncluded: Boolean(input.isIncluded),
      unitPrice,
      isDefault: Boolean(input.isDefault),
    },
  };
}

export async function addGroup(
  templateId: string, input: AddTemplateGroupInput,
): Promise<AddTemplateGroupResult> {
  const parsed = parseGroupWrite(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = await withVenue(async (supabase, venueId) => {
    const sortOrder = await repo.nextSortOrder(
      supabase, "event_order_template_groups", templateId, parsed.write.sectionId,
    );
    const group = await repo.insertGroup(supabase, venueId, templateId, parsed.write, sortOrder);
    return { ok: true, group } as AddTemplateGroupResult;
  });
  return result as AddTemplateGroupResult;
}

export async function updateGroup_(
  groupId: string, input: AddTemplateGroupInput,
): Promise<EventOrderTemplateActionResult> {
  const parsed = parseGroupWrite(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateGroup(supabase, venueId, groupId, parsed.write);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function removeGroup_(groupId: string): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeGroup(supabase, venueId, groupId);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function reorderGroups(orderedIds: string[]): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reorderRows(supabase, "event_order_template_groups", venueId, orderedIds);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function addOption(
  templateId: string, input: AddTemplateOptionInput,
): Promise<AddTemplateOptionResult> {
  const parsed = parseOptionWrite(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = await withVenue(async (supabase, venueId) => {
    const sortOrder = await repo.nextSortOrder(
      supabase, "event_order_template_options", templateId, parsed.write.groupId,
    );
    const option = await repo.insertOption(supabase, venueId, templateId, parsed.write, sortOrder);
    return { ok: true, option } as AddTemplateOptionResult;
  });
  return result as AddTemplateOptionResult;
}

export async function updateOption_(
  optionId: string, input: AddTemplateOptionInput,
): Promise<EventOrderTemplateActionResult> {
  const parsed = parseOptionWrite(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateOption(supabase, venueId, optionId, parsed.write);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function removeOption_(optionId: string): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeOption(supabase, venueId, optionId);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

export async function reorderOptions(orderedIds: string[]): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reorderRows(supabase, "event_order_template_options", venueId, orderedIds);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}
