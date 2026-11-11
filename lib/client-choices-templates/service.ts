import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/client-choices-templates/repository";
import type {
  ChoicesTemplate,
  ChoicesTemplateActionResult,
  ChoicesTemplateInput,
  ChoicesTemplateWithDetails,
  CreateChoicesTemplateResult,
} from "@/lib/client-choices-templates/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | ChoicesTemplateActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getTemplates(includeArchived = false): Promise<ChoicesTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id, includeArchived);
}

export async function getTemplate(id: string): Promise<ChoicesTemplateWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplateWithDetails(await createClient(), venue.id, id);
}

export async function createTemplate(input: ChoicesTemplateInput): Promise<CreateChoicesTemplateResult> {
  if (!input.name.trim()) return { ok: false, errors: { name: "Name is required." } };
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.insertTemplate(supabase, venueId, input);
    return { ok: true, templateId } as CreateChoicesTemplateResult;
  });
  return result as CreateChoicesTemplateResult;
}

export async function updateTemplate(id: string, input: ChoicesTemplateInput): Promise<ChoicesTemplateActionResult> {
  if (!input.name.trim()) return { ok: false, errors: { name: "Name is required." } };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateTemplate(supabase, venueId, id, input);
    return { ok: true } as ChoicesTemplateActionResult;
  });
  return result as ChoicesTemplateActionResult;
}

export async function setTemplateArchived(id: string, archived: boolean): Promise<ChoicesTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setArchived(supabase, venueId, id, archived);
    return { ok: true } as ChoicesTemplateActionResult;
  });
  return result as ChoicesTemplateActionResult;
}

export async function deleteTemplate(id: string): Promise<ChoicesTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteTemplate(supabase, venueId, id);
    return { ok: true } as ChoicesTemplateActionResult;
  });
  return result as ChoicesTemplateActionResult;
}

export async function addSection(templateId: string, name: string): Promise<ChoicesTemplateActionResult> {
  if (!name.trim()) return { ok: false, message: "Section name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const sort = await repo.nextSort(supabase, "client_choices_template_sections", "template_id", templateId);
    await repo.insertSection(supabase, venueId, templateId, name, sort);
    return { ok: true } as ChoicesTemplateActionResult;
  });
  return result as ChoicesTemplateActionResult;
}

export async function addGroup(
  templateId: string,
  input: {
    sectionId: string | null;
    name: string;
    instructions?: string;
    selectionMode: "single" | "multi";
    minSelect: number;
    maxSelect: number | null;
    allowQuantity: boolean;
  },
): Promise<ChoicesTemplateActionResult> {
  if (!input.name.trim()) return { ok: false, message: "Group name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const sort = await repo.nextSort(supabase, "client_choices_template_groups", "template_id", templateId);
    await repo.insertGroup(supabase, venueId, templateId, { ...input, sortOrder: sort });
    return { ok: true } as ChoicesTemplateActionResult;
  });
  return result as ChoicesTemplateActionResult;
}

export async function addOption(
  templateId: string,
  input: {
    groupId: string;
    offeringId: string | null;
    label: string;
    description?: string;
    isIncluded: boolean;
    unitPrice: number | null;
  },
): Promise<ChoicesTemplateActionResult> {
  if (!input.label.trim()) return { ok: false, message: "Option label is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const sort = await repo.nextSort(supabase, "client_choices_template_options", "group_id", input.groupId);
    await repo.insertOption(supabase, venueId, templateId, { ...input, sortOrder: sort });
    return { ok: true } as ChoicesTemplateActionResult;
  });
  return result as ChoicesTemplateActionResult;
}

export async function removeGroup(groupId: string): Promise<ChoicesTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteGroup(supabase, venueId, groupId);
    return { ok: true } as ChoicesTemplateActionResult;
  });
  return result as ChoicesTemplateActionResult;
}

export async function removeOption(optionId: string): Promise<ChoicesTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteOption(supabase, venueId, optionId);
    return { ok: true } as ChoicesTemplateActionResult;
  });
  return result as ChoicesTemplateActionResult;
}

export async function duplicateTemplate(
  sourceId: string,
  newName: string,
): Promise<CreateChoicesTemplateResult> {
  if (!newName.trim()) return { ok: false, errors: { name: "Name is required." } };
  const result = await withVenue(async (supabase, venueId) => {
    const source = await repo.getTemplateWithDetails(supabase, venueId, sourceId);
    if (!source) return { ok: false, message: "Template not found." } as CreateChoicesTemplateResult;
    const templateId = await repo.insertTemplate(supabase, venueId, {
      name: newName.trim(),
      description: source.description ?? "",
    });
    const sectionIdMap = new Map<string, string>();
    for (const s of [...source.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const created = await repo.insertSection(supabase, venueId, templateId, s.name, s.sortOrder);
      sectionIdMap.set(s.id, created.id);
    }
    const groupIdMap = new Map<string, string>();
    for (const g of [...source.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const created = await repo.insertGroup(supabase, venueId, templateId, {
        sectionId: g.sectionId ? sectionIdMap.get(g.sectionId) ?? null : null,
        name: g.name,
        instructions: g.instructions ?? undefined,
        selectionMode: g.selectionMode,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        allowQuantity: g.allowQuantity,
        sortOrder: g.sortOrder,
      });
      groupIdMap.set(g.id, created.id);
    }
    for (const o of [...source.options].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const groupId = groupIdMap.get(o.groupId);
      if (!groupId) continue;
      await repo.insertOption(supabase, venueId, templateId, {
        groupId,
        offeringId: o.offeringId,
        label: o.label,
        description: o.description ?? undefined,
        isIncluded: o.isIncluded,
        unitPrice: o.unitPrice,
        sortOrder: o.sortOrder,
      });
    }
    return { ok: true, templateId } as CreateChoicesTemplateResult;
  });
  return result as CreateChoicesTemplateResult;
}
