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
import { clientDisplayName } from "@/lib/clients/constants";
import { getEventIdForClient, insertEvent } from "@/lib/events/repository";
import { createPortalSession } from "@/lib/portal/service";
import type { Lead } from "@/lib/leads/types";
import { getCurrentVenue } from "@/lib/venue/service";

/**
 * If the client has an event date, automatically create the linked event.
 * Called inside the same withVenue callback as insertClient so both rows
 * share the same authenticated Supabase client and venue context.
 */
async function autoCreateEvent(
  supabase: Parameters<typeof insertEvent>[0],
  venueId: string,
  clientId: string,
  opts: {
    firstName: string;
    lastName: string;
    partnerFirstName?: string | null;
    partnerLastName?: string | null;
    eventDate: string;
    eventType?: string | null;
    guestCount?: string | null;
    startTime?: string | null;
    endTime?: string | null;
  },
): Promise<string> {
  // Guard against duplicate events if someone edits the client or re-runs conversion
  const existing = await getEventIdForClient(supabase, venueId, clientId);
  if (existing) return existing;

  const coupleName = clientDisplayName(opts.firstName, opts.lastName, opts.partnerFirstName, opts.partnerLastName);
  const typeLabel = opts.eventType?.replace(/_/g, " ") ?? "Event";
  return insertEvent(supabase, venueId, {
    name: `${coupleName} — ${typeLabel}`,
    eventType: opts.eventType ?? "",
    eventDate: opts.eventDate,
    startTime: opts.startTime ?? "",
    endTime: opts.endTime ?? "",
    setupTime: "",
    teardownTime: "",
    guestCount: opts.guestCount ?? "",
    clientId,
    spaceId: "",
  });
}

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

export async function getClients(filters?: { q?: string; status?: string }): Promise<Client[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getClients(await createClient(), venue.id, filters);
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
    // Server-side hard block: refuse if the event date is calendar-blocked.
    if (input.eventDate) {
      const { data: blocks } = await supabase.from("calendar_blocks")
        .select("title").eq("venue_id", venueId)
        .lte("start_date", input.eventDate).gte("end_date", input.eventDate)
        .limit(1);
      if (blocks && blocks.length > 0) {
        const title = (blocks[0] as { title: string }).title;
        return { ok: false, message: `Cannot book this date — the calendar is blocked: "${title}". Remove the block first.` } as CreateClientResult;
      }
    }
    const clientId = await repo.insertClient(supabase, venueId, input);
    const eventId = input.eventDate
      ? await autoCreateEvent(supabase, venueId, clientId, {
          firstName: input.firstName,
          lastName: input.lastName,
          partnerFirstName: input.partnerFirstName,
          partnerLastName: input.partnerLastName,
          eventDate: input.eventDate,
          eventType: input.eventType,
          guestCount: input.guestCount,
          startTime: input.ceremonyTime,
        })
      : null;
    return { ok: true, clientId, eventId } as CreateClientResult;
  });
  const r = result as CreateClientResult;
  if (!r.ok) return r;
  const coupleName = clientDisplayName(input.firstName, input.lastName, input.partnerFirstName, input.partnerLastName);
  const portal = await createPortalSession(r.clientId, coupleName, "couple");
  return { ok: true, clientId: r.clientId, eventId: r.eventId, portalToken: portal?.accessToken ?? null };
}

/** Convert a won lead to a client. Pre-populates from lead data. */
// Imported lazily to avoid circular deps between client and availability modules
async function convertLeadHolds(venueId: string, leadId: string, supabase: Parameters<typeof repo.insertClient>[0]) {
  // Convert all active date holds for this lead to "converted" status
  const { error } = await supabase.from("date_holds")
    .update({ status: "converted" })
    .eq("venue_id", venueId)
    .eq("lead_id", leadId)
    .eq("status", "active");
  if (error) console.error("Could not convert holds:", error.message);
}

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
    // Server-side hard block: refuse if the lead's event date is calendar-blocked.
    if (input.eventDate) {
      const { data: blocks } = await supabase.from("calendar_blocks")
        .select("title").eq("venue_id", venueId)
        .lte("start_date", input.eventDate).gte("end_date", input.eventDate)
        .limit(1);
      if (blocks && blocks.length > 0) {
        const title = (blocks[0] as { title: string }).title;
        return { ok: false, message: `Cannot convert this lead — their event date is blocked: "${title}". Remove the block first, or update the event date.` } as CreateClientResult;
      }
    }
    const clientId = await repo.insertClient(supabase, venueId, input, lead.id);
    await repo.insertClientActivity(supabase, venueId, clientId, "note_added",
      "Welcome note", `Converted from lead inquiry — ${lead.firstName} ${lead.lastName}`);
    await convertLeadHolds(venueId, lead.id, supabase);
    const eventId = input.eventDate
      ? await autoCreateEvent(supabase, venueId, clientId, {
          firstName: lead.firstName,
          lastName: lead.lastName,
          partnerFirstName: lead.partnerFirstName,
          partnerLastName: lead.partnerLastName,
          eventDate: input.eventDate,
          eventType: input.eventType,
          guestCount: input.guestCount,
        })
      : null;
    return { ok: true, clientId, eventId } as CreateClientResult;
  });
  const r = result as CreateClientResult;
  if (!r.ok) return r;
  const coupleName = clientDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName);
  const portal = await createPortalSession(r.clientId, coupleName, "couple");
  return { ok: true, clientId: r.clientId, eventId: r.eventId, portalToken: portal?.accessToken ?? null };
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
