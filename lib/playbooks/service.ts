import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_WEDDING_TASKS } from "@/lib/playbooks/constants";
import * as repo from "@/lib/playbooks/repository";
import type {
  CreatePlaybookResult,
  EventReadiness,
  EventTask,
  PlaybookActionResult,
  PlaybookTask,
  PlaybookTemplate,
} from "@/lib/playbooks/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(fn: (c: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>): Promise<T | PlaybookActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  return fn(supabase, venue.id);
}

// ---- Templates ---------------------------------------------------------------

export async function getTemplates(): Promise<PlaybookTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id);
}

export async function createTemplate(name: string, eventType: string | null, description: string | null): Promise<CreatePlaybookResult> {
  if (!name.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVenue(async (c, venueId) => {
    const templateId = await repo.insertTemplate(c, venueId, name, eventType, description);
    return { ok: true, templateId } as CreatePlaybookResult;
  });
  return result as CreatePlaybookResult;
}

export async function deleteTemplate_(id: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.deleteTemplate(c, venueId, id);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Template Tasks ----------------------------------------------------------

export async function getTemplate(id: string): Promise<PlaybookTemplate | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplate(await createClient(), venue.id, id);
}

export async function getTemplateTasks(templateId: string): Promise<PlaybookTask[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplateTasks(await createClient(), venue.id, templateId);
}

export async function addTemplateTask(templateId: string, task: Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.insertTemplateTask(c, venueId, templateId, task);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function updateTemplateTask_(taskId: string, patch: Partial<Omit<PlaybookTask, "id" | "templateId" | "venueId" | "createdAt">>): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateTemplateTask(c, venueId, taskId, patch);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function deleteTemplateTask_(taskId: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.deleteTemplateTask(c, venueId, taskId);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

// ---- Event Tasks -------------------------------------------------------------

export async function getEventTasks(eventId: string): Promise<EventTask[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getEventTasks(await createClient(), venue.id, eventId);
}

export async function applyPlaybookToEvent(eventId: string, templateId: string, eventDate: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.applyPlaybookToEvent(c, venueId, eventId, templateId, eventDate);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function completeEventTask_(taskId: string, completedBy?: string): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.completeEventTask(c, venueId, taskId, completedBy);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

export async function setEventTaskStatus(taskId: string, status: "waived" | "pending"): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateEventTaskStatus(c, venueId, taskId, status);
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}

/** Call this after any milestone event fires — auto-completes matching tasks. */
export async function triggerAutoComplete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventId: string,
  trigger: string,
  sourceType?: string,
  sourceId?: string,
): Promise<void> {
  await repo.autoCompleteTrigger(supabase, venueId, eventId, trigger, sourceType, sourceId);
}

// ---- Event Readiness (replaces hardcoded computeEventReadiness) -------------

export async function getEventReadiness(clientId: string): Promise<EventReadiness | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.computeEventReadinessFromPlaybook(await createClient(), venue.id, clientId);
}

// ---- Seed default Wedding template ------------------------------------------

export async function seedDefaultWeddingTemplate(): Promise<PlaybookActionResult> {
  const result = await withVenue(async (c, venueId) => {
    // Check if a template already exists
    const existing = await repo.getTemplates(c, venueId);
    if (existing.length > 0) return { ok: true } as PlaybookActionResult; // already seeded

    const templateId = await repo.insertTemplate(c, venueId, "Standard Wedding", "wedding", "Default wedding event playbook with key milestones.");
    for (const task of DEFAULT_WEDDING_TASKS) {
      await repo.insertTemplateTask(c, venueId, templateId, task);
    }
    return { ok: true } as PlaybookActionResult;
  });
  return result as PlaybookActionResult;
}
