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
import { findOrCreateOfferingCategory } from "@/lib/offerings/category-identity";
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
    // Keep Offerings catalog categories aligned — do not create a second free-text identity.
    await findOrCreateOfferingCategory(supabase, venueId, section.name);
    return { ok: true, section } as AddTemplateSectionResult;
  });
  return result as AddTemplateSectionResult;
}

export async function updateSection(
  sectionId: string, input: repo.SectionUpdateInput,
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
      dependsOnOptionIds: (input.dependsOnOptionIds ?? []).filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
      ...(input.offeringChoiceGroupId !== undefined
        ? { offeringChoiceGroupId: input.offeringChoiceGroupId }
        : {}),
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
      imageUrl: input.imageUrl?.trim() || null,
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

/**
 * Include an Offerings catalog choice group under a parent template option:
 * create a dependent template group (name + catalog id snapshot) and snapshot
 * current member Offerings as options. Catalog edits afterward do not mutate
 * this snapshot.
 */
export async function includeCatalogChoiceGroup(input: {
  templateId: string;
  sectionId: string;
  parentOptionId: string;
  catalogGroupId: string;
  selectCount?: number;
  required?: boolean;
}): Promise<AddTemplateGroupResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const template = await repo.getTemplateWithDetails(supabase, venueId, input.templateId);
    if (!template) return { ok: false as const, message: "Template not found." };

    const parentOption = template.options.find((o) => o.id === input.parentOptionId);
    if (!parentOption?.offeringId) {
      return { ok: false as const, message: "Select a parent Offering first." };
    }

    const already = template.groups.some(
      (g) =>
        g.offeringChoiceGroupId === input.catalogGroupId &&
        (g.dependsOnOptionIds ?? []).includes(input.parentOptionId),
    );
    if (already) {
      return {
        ok: false as const,
        message: "That catalog group is already included under this parent.",
      };
    }

    const { listChoiceGroupsForVenue } = await import(
      "@/lib/offerings/choice-groups-repository"
    );
    const { getOfferingsWithCategory } = await import("@/lib/offerings/repository");
    const { optionInputFromOffering, newCatalogChildGroupUnderParentInput } = await import(
      "@/lib/event-order-templates/offering-package-builder"
    );
    const { memberOfferingsForGroup } = await import("@/lib/offerings/choice-groups");

    const catalogGroups = await listChoiceGroupsForVenue(supabase, venueId);
    const catalogGroup = catalogGroups.find((g) => g.id === input.catalogGroupId);
    if (!catalogGroup) {
      return { ok: false as const, message: "Catalog group not found." };
    }
    if (catalogGroup.parentOfferingId !== parentOption.offeringId) {
      return {
        ok: false as const,
        message: "That group belongs to a different parent Offering.",
      };
    }

    const groupInput = newCatalogChildGroupUnderParentInput(
      input.sectionId,
      parentOption,
      catalogGroup,
      {
        selectCount: input.selectCount ?? 1,
        required: input.required ?? true,
      },
    );
    const parsed = parseGroupWrite(groupInput);
    if (!parsed.ok) return { ok: false as const, errors: parsed.errors };

    const sortOrder = await repo.nextSortOrder(
      supabase,
      "event_order_template_groups",
      input.templateId,
      parsed.write.sectionId,
    );
    const group = await repo.insertGroup(
      supabase,
      venueId,
      input.templateId,
      parsed.write,
      sortOrder,
    );

    const offerings = await getOfferingsWithCategory(supabase, venueId);
    const members = memberOfferingsForGroup(catalogGroup, offerings);
    for (const offering of members) {
      const optWrite = parseOptionWrite(optionInputFromOffering(group.id, offering));
      if (!optWrite.ok) continue;
      const optSort = await repo.nextSortOrder(
        supabase,
        "event_order_template_options",
        input.templateId,
        group.id,
      );
      await repo.insertOption(
        supabase,
        venueId,
        input.templateId,
        optWrite.write,
        optSort,
      );
    }

    return { ok: true as const, group };
  });
  return result as AddTemplateGroupResult;
}
