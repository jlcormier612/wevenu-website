"use server";

import { createLead } from "@/lib/leads/service";
import type { CreateLeadResult, LeadInput } from "@/lib/leads/types";

export async function createLeadAction(
  input: LeadInput,
): Promise<CreateLeadResult> {
  return createLead(input);
}
