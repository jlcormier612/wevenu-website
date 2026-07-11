/**
 * Message Template Library application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/message-templates/repository";
import { validateMessageTemplateInput } from "@/lib/message-templates/validation";
import type {
  CreateMessageTemplateResult,
  MessageTemplate,
  MessageTemplateActionResult,
  MessageTemplateInput,
} from "@/lib/message-templates/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | MessageTemplateActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getTemplates(): Promise<MessageTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id);
}

export async function getTemplate(id: string): Promise<MessageTemplate | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplate(await createClient(), venue.id, id);
}

export async function createTemplate(input: MessageTemplateInput): Promise<CreateMessageTemplateResult> {
  const errors = validateMessageTemplateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.insertTemplate(supabase, venueId, input);
    return { ok: true, templateId } as CreateMessageTemplateResult;
  });
  return result as CreateMessageTemplateResult;
}

export async function updateTemplate_(id: string, input: MessageTemplateInput): Promise<MessageTemplateActionResult> {
  const errors = validateMessageTemplateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateTemplate(supabase, venueId, id, input);
    return { ok: true } as MessageTemplateActionResult;
  });
  return result as MessageTemplateActionResult;
}

export async function deleteTemplate_(id: string): Promise<MessageTemplateActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteTemplate(supabase, venueId, id);
    return { ok: true } as MessageTemplateActionResult;
  });
  return result as MessageTemplateActionResult;
}
