/**
 * Clients application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/clients/repository";
import type {
  Client,
  ClientActionResult,
  ClientInput,
  ClientStatus,
  ClientWithDetails,
  CreateClientResult,
  KeyDateInput,
} from "@/lib/clients/types";
import {
  validateClientInput,
  validateClientStatus,
  validateKeyDateInput,
} from "@/lib/clients/validation";
import type { Lead } from "@/lib/leads/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | ClientActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

// ---- read -------------------------------------------------------------------

export async function getClients(): Promise<Client[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getClients(await createClient(), venue.id);
}

export async function getClient(clientId: string): Promise<ClientWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getClient(await createClient(), venue.id, clientId);
}

// ---- create -----------------------------------------------------------------

export async function createClient_(input: ClientInput): Promise<CreateClientResult> {
  const errors = validateClientInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const clientId = await repo.insertClient(supabase, venueId, input);
    return { ok: true, clientId } as CreateClientResult;
  });
  return result as CreateClientResult;
}

/** Convert a won lead to a client. Pre-populates from lead data. */
export async function convertLeadToClient(lead: Lead): Promise<CreateClientResult> {
  const input: ClientInput = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    partnerFirstName: lead.partnerFirstName ?? "",
    partnerLastName: lead.partnerLastName ?? "",
    partnerEmail: lead.partnerEmail ?? "",
    eventType: lead.eventType ?? "",
    eventDate: lead.eventDate ?? "",
    endDate: lead.endDate ?? "",
    guestCount: lead.guestCount != null ? String(lead.guestCount) : "",
    ceremonyTime: "",
    receptionTime: "",
    rehearsalDate: "",
    internalNotes: "",
  };
  const result = await withVenue(async (supabase, venueId) => {
    const clientId = await repo.insertClient(supabase, venueId, input, lead.id);
    await repo.insertClientActivity(supabase, venueId, clientId, "note_added",
      "Welcome note", `Converted from lead inquiry — ${lead.firstName} ${lead.lastName}`);
    return { ok: true, clientId } as CreateClientResult;
  });
  return result as CreateClientResult;
}

// ---- update -----------------------------------------------------------------

export async function updateClientInfo(clientId: string, input: ClientInput): Promise<ClientActionResult> {
  const errors = validateClientInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateClientInfo(supabase, venueId, clientId, input);
    await repo.insertClientActivity(supabase, venueId, clientId, "lead_updated", "Client information updated");
    return { ok: true } as ClientActionResult;
  });
  return result as ClientActionResult;
}

export async function updateClientStatus_(clientId: string, status: string): Promise<ClientActionResult> {
  if (!validateClientStatus(status)) return { ok: false, message: `"${status}" is not a valid status.` };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateClientStatus(supabase, venueId, clientId, status as ClientStatus);
    return { ok: true } as ClientActionResult;
  });
  return result as ClientActionResult;
}

// ---- notes ------------------------------------------------------------------

export async function addClientNote(clientId: string, body: string): Promise<ClientActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertClientNote(supabase, venueId, clientId, body);
    await repo.insertClientActivity(supabase, venueId, clientId, "note_added", "Note added");
    return { ok: true } as ClientActionResult;
  });
  return result as ClientActionResult;
}

export async function updateClientNote_(noteId: string, clientId: string, body: string): Promise<ClientActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateClientNote(supabase, venueId, noteId, body);
    await repo.insertClientActivity(supabase, venueId, clientId, "note_updated", "Note edited");
    return { ok: true } as ClientActionResult;
  });
  return result as ClientActionResult;
}

export async function deleteClientNote_(noteId: string): Promise<ClientActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteClientNote(supabase, venueId, noteId);
    return { ok: true } as ClientActionResult;
  });
  return result as ClientActionResult;
}

// ---- key dates --------------------------------------------------------------

export async function addKeyDate(clientId: string, input: KeyDateInput): Promise<ClientActionResult> {
  const errors = validateKeyDateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors, message: errors.label ?? errors.date };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertKeyDate(supabase, venueId, clientId, input);
    await repo.insertClientActivity(supabase, venueId, clientId, "key_date_added",
      `Key date added: ${input.label}`);
    return { ok: true } as ClientActionResult;
  });
  return result as ClientActionResult;
}

export async function deleteKeyDate_(kdId: string): Promise<ClientActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteKeyDate(supabase, venueId, kdId);
    return { ok: true } as ClientActionResult;
  });
  return result as ClientActionResult;
}
