/**
 * Event Order Templates application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/event-order-templates/repository";
import type {
  AddTemplateLineInput, AddTemplateLineResult, AddTemplateSectionResult,
  CreateEventOrderTemplateResult, EventOrderTemplate, EventOrderTemplateActionResult,
  EventOrderTemplateInput, EventOrderTemplateWithDetails,
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

export async function addSection(templateId: string, name: string): Promise<AddTemplateSectionResult> {
  if (!name.trim()) return { ok: false, message: "Give this section a name." };
  const result = await withVenue(async (supabase, venueId) => {
    const sortOrder = await repo.nextSortOrder(supabase, "event_order_template_sections", templateId);
    const section = await repo.insertSection(supabase, venueId, templateId, name, sortOrder);
    return { ok: true, section } as AddTemplateSectionResult;
  });
  return result as AddTemplateSectionResult;
}

export async function removeSection(sectionId: string): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeSection(supabase, venueId, sectionId);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}

// ---- lines --------------------------------------------------------------------------

export async function addLine(templateId: string, input: AddTemplateLineInput): Promise<AddTemplateLineResult> {
  if (!input.description.trim()) return { ok: false, errors: { description: "Description is required." } };
  const qty = Number(input.quantity);
  if (!(qty > 0)) return { ok: false, errors: { quantity: "Enter a valid quantity." } };
  const price = Number(input.unitPrice.replace(/[$,]/g, ""));
  if (isNaN(price) || price < 0) return { ok: false, errors: { unitPrice: "Enter a valid price." } };
  const result = await withVenue(async (supabase, venueId) => {
    const sortOrder = await repo.nextSortOrder(supabase, "event_order_template_lines", templateId);
    const line = await repo.insertLine(supabase, venueId, templateId, {
      sectionId: input.sectionId, description: input.description, quantity: qty, unitPrice: price,
    }, sortOrder);
    return { ok: true, line } as AddTemplateLineResult;
  });
  return result as AddTemplateLineResult;
}

export async function removeLine(lineId: string): Promise<EventOrderTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.removeLine(supabase, venueId, lineId);
    return { ok: true } as EventOrderTemplateActionResult;
  });
  return result as EventOrderTemplateActionResult;
}
