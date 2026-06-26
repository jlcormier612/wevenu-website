/**
 * Leads application service.
 * Orchestrates auth, venue lookup, validation, and persistence.
 * Components and server actions call here — never the repository directly.
 * Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/leads/repository";
import type {
  CreateLeadResult,
  Lead,
  LeadActionResult,
  LeadInput,
  LeadStatus,
  LeadWithDetails,
  TaskInput,
} from "@/lib/leads/types";
import {
  validateLeadInput,
  validateStatus,
  validateTaskInput,
} from "@/lib/leads/validation";
import { getCurrentVenue } from "@/lib/venue/service";

/** Shared auth + venue guard. Returns a typed error if anything is missing. */
async function withVenue<T>(
  fn: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    venueId: string,
  ) => Promise<T>,
): Promise<T | LeadActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue)
    return { ok: false, message: "No venue found. Complete setup first." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, message: "Session expired. Please sign in again." };
  return fn(supabase, venue.id);
}

// ---- read -------------------------------------------------------------------

export async function getLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return repo.getLeads(supabase, venue.id);
}

export async function getLead(leadId: string): Promise<LeadWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.getLead(supabase, venue.id, leadId);
}

// ---- create -----------------------------------------------------------------

export async function createLead(input: LeadInput): Promise<CreateLeadResult> {
  const errors = validateLeadInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const leadId = await repo.insertLead(supabase, venueId, input);
    return { ok: true, leadId } as CreateLeadResult;
  });
  if ("ok" in result && result.ok === false) return result as CreateLeadResult;
  return result as CreateLeadResult;
}

// ---- update status ----------------------------------------------------------

export async function updateLeadStatus(
  leadId: string,
  status: string,
): Promise<LeadActionResult> {
  if (!validateStatus(status))
    return { ok: false, message: `"${status}" is not a valid status.` };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateLeadStatus(supabase, venueId, leadId, status as LeadStatus);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

// ---- notes ------------------------------------------------------------------

export async function addNote(
  leadId: string,
  body: string,
): Promise<LeadActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertNote(supabase, venueId, leadId, body);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function deleteNote(noteId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteNote(supabase, venueId, noteId);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

// ---- tasks ------------------------------------------------------------------

export async function addTask(
  leadId: string,
  input: TaskInput,
): Promise<LeadActionResult> {
  const errors = validateTaskInput(input);
  if (Object.keys(errors).length > 0)
    return { ok: false, errors, message: errors.title };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertTask(supabase, venueId, leadId, input);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function setTaskCompleted(
  taskId: string,
  completed: boolean,
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setTaskCompleted(supabase, venueId, taskId, completed);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function deleteTask(taskId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteTask(supabase, venueId, taskId);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}
