/**
 * Contracts application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/contracts/repository";
import { buildMergeData, mergeContent } from "@/lib/contracts/merge";
import { recordEngagementEvent } from "@/lib/activation/service";
import type {
  Contract,
  ContractActionResult,
  ContractTemplate,
  ContractWithDetails,
  CreateContractResult,
  CreateTemplateResult,
  NewContractInput,
  TemplateInput,
} from "@/lib/contracts/types";
import {
  validateNewContractInput,
  validateTemplateInput,
} from "@/lib/contracts/validation";
import { getClient } from "@/lib/clients/service";
import { getEvent } from "@/lib/events/service";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | ContractActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

// ---- templates --------------------------------------------------------------

export async function getTemplates(): Promise<ContractTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getTemplates(await createClient(), venue.id);
}

export async function getTemplate(id: string): Promise<ContractTemplate | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getTemplate(await createClient(), venue.id, id);
}

export async function createTemplate(input: TemplateInput): Promise<CreateTemplateResult> {
  const errors = validateTemplateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const templateId = await repo.insertTemplate(supabase, venueId, input);
    return { ok: true, templateId } as CreateTemplateResult;
  });
  return result as CreateTemplateResult;
}

export async function updateTemplate_(id: string, input: TemplateInput): Promise<ContractActionResult> {
  const errors = validateTemplateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateTemplate(supabase, venueId, id, input);
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function deleteTemplate_(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteTemplate(supabase, venueId, id);
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

// ---- contracts --------------------------------------------------------------

export async function getContracts(): Promise<Contract[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getContracts(await createClient(), venue.id);
}

export async function getContractDetail(id: string): Promise<ContractWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getContract(await createClient(), venue.id, id);
}

/** Get a contract by its public sign_token (no auth required). */
export async function getContractByToken(token: string): Promise<Contract | null> {
  if (!isSupabaseConfigured) return null;
  return repo.getContractByToken(await createClient(), token);
}

/**
 * Generate a contract from a template + client/event.
 * Merges all available fields from the client, event, and venue.
 */
export async function createContract(input: NewContractInput): Promise<CreateContractResult> {
  const errors = validateNewContractInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const contractId = await repo.insertContract(supabase, venueId, input);
    await repo.insertContractActivity(supabase, venueId, contractId, "contract_created", "Contract created");
    return { ok: true, contractId } as CreateContractResult;
  });
  return result as CreateContractResult;
}

/** Build merge data from the current venue + client + event. */
export async function buildContractMergeData(opts: {
  clientId?: string;
  eventId?: string;
  contractTitle?: string;
}): Promise<Record<string, string>> {
  const [venue, client, event] = await Promise.all([
    getCurrentVenue(),
    opts.clientId ? getClient(opts.clientId) : Promise.resolve(null),
    opts.eventId ? getEvent(opts.eventId) : Promise.resolve(null),
  ]);
  return buildMergeData({
    venueName: venue?.name ?? "",
    clientFirstName: client?.firstName ?? "",
    clientLastName: client?.lastName ?? "",
    partnerFirstName: client?.partnerFirstName ?? null,
    partnerLastName: client?.partnerLastName ?? null,
    eventDate: event?.eventDate ?? client?.eventDate ?? null,
    eventType: event?.eventType ?? client?.eventType ?? null,
    guestCount: event?.guestCount ?? client?.guestCount ?? null,
    contractTitle: opts.contractTitle ?? "",
  });
}

export async function updateContractContent_(id: string, title: string, content: string): Promise<ContractActionResult> {
  if (!title.trim() || !content.trim()) return { ok: false, message: "Title and content are required." };
  const result = await withVenue(async (supabase, venueId) => {
    const outcome = await repo.updateContractContent(supabase, venueId, id, title, content);
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function sendContract(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateContractStatus(supabase, venueId, id, "sent", { sentAt: true });
    await repo.insertContractActivity(supabase, venueId, id, "sent", "Contract sent for signing");
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function cancelContract(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateContractStatus(supabase, venueId, id, "cancelled");
    await repo.insertContractActivity(supabase, venueId, id, "cancelled", "Contract cancelled");
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

export async function deleteContract_(id: string): Promise<ContractActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const outcome = await repo.deleteContract(supabase, venueId, id);
    if (!outcome.ok) return { ok: false, message: outcome.message } as ContractActionResult;
    return { ok: true } as ContractActionResult;
  });
  return result as ContractActionResult;
}

/** Public action — signs via the SECURITY DEFINER RPC (no venue auth needed). */
export async function signContractByToken(token: string, signerName: string): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!signerName.trim()) return { ok: false, message: "Please enter your full name." };
  const supabase = await createClient();

  // Look up venue_id before signing so we can fire the engagement event
  const { data: contractRow } = await supabase
    .from("contracts")
    .select("id, venue_id")
    .eq("sign_token", token)
    .maybeSingle<{ id: string; venue_id: string }>();

  const { data, error } = await supabase.rpc("sign_contract", {
    p_token: token,
    p_signer: signerName.trim(),
  });
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "This contract is not available for signing." };

  if (contractRow?.venue_id) {
    void recordEngagementEvent({
      venueId:   contractRow.venue_id,
      eventType: "contract.signed",
      actorType: "couple",
      entityType: "contract",
      entityId:  contractRow.id,
    });
  }

  return { ok: true };
}

export { mergeContent };
