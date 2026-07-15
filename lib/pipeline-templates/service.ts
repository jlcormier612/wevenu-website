/**
 * Pipeline Templates application service — Phase 1. Server-only.
 * Deliberately has no dependency on lib/leads anywhere — this phase builds
 * the reusable template/stage editor only, per explicit instruction.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/pipeline-templates/repository";
import { validatePipelineTemplateInput } from "@/lib/pipeline-templates/validation";
import type {
  CreatePipelineTemplateResult, PipelineTemplate, PipelineTemplateActionResult,
  PipelineTemplateInput, PipelineTemplateWithStages,
} from "@/lib/pipeline-templates/types";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>>;

async function withVenue<T>(
  fn: (supabase: DbClient, venueId: string) => Promise<T>,
): Promise<T | PipelineTemplateActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getTemplates(): Promise<PipelineTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id);
}

/** The venue's active Pipeline Template, or null if it has none — callers must fall back to the existing status-only experience in that case. */
export async function getActiveTemplate(): Promise<PipelineTemplateWithStages | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getActiveTemplateWithStages(await createClient(), venue.id);
}

export async function getTemplate(id: string): Promise<PipelineTemplateWithStages | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplateWithStages(await createClient(), venue.id, id);
}

export async function createTemplate(input: PipelineTemplateInput): Promise<CreatePipelineTemplateResult> {
  const errors = validatePipelineTemplateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.insertTemplate(supabase, venueId, input);
    return { ok: true, templateId } as CreatePipelineTemplateResult;
  });
  return result as CreatePipelineTemplateResult;
}

export async function updateTemplate_(id: string, input: PipelineTemplateInput): Promise<PipelineTemplateActionResult> {
  const errors = validatePipelineTemplateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateTemplate(supabase, venueId, id, input);
    return { ok: true } as PipelineTemplateActionResult;
  });
  return result as PipelineTemplateActionResult;
}

export async function deleteTemplate_(id: string): Promise<PipelineTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteTemplate(supabase, venueId, id);
    return { ok: true } as PipelineTemplateActionResult;
  });
  return result as PipelineTemplateActionResult;
}

export async function duplicateTemplate_(id: string, newName: string): Promise<CreatePipelineTemplateResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.duplicateTemplate(supabase, venueId, id, newName);
    return { ok: true, templateId } as CreatePipelineTemplateResult;
  });
  return result as CreatePipelineTemplateResult;
}

export async function setTemplateActive_(id: string, isActive: boolean): Promise<PipelineTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setTemplateActive(supabase, venueId, id, isActive);
    return { ok: true } as PipelineTemplateActionResult;
  });
  return result as PipelineTemplateActionResult;
}
