"use server";

import { revalidatePath } from "next/cache";

import { createClient_, convertLeadToClient } from "@/lib/clients/service";
import type { ClientInput, CreateClientResult } from "@/lib/clients/types";
import type { Lead } from "@/lib/leads/types";

export async function createClientAction(input: ClientInput): Promise<CreateClientResult> {
  const result = await createClient_(input);
  if (result.ok) revalidatePath("/clients");
  return result;
}

export async function convertLeadToClientAction(lead: Lead, spaceId?: string): Promise<CreateClientResult> {
  const result = await convertLeadToClient(lead, { spaceId });
  if (result.ok) { revalidatePath("/clients"); revalidatePath(`/leads/${lead.id}`); }
  return result;
}
