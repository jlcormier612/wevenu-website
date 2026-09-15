"use server";

import { createLead } from "@/lib/leads/service";
import type { CreateLeadResult, LeadInput } from "@/lib/leads/types";

export async function createLeadAction(
  input: LeadInput,
): Promise<CreateLeadResult> {
  return createLead(input);
}

/** Venue-side possible-match preview. Create still requires an identity decision. */
export async function previewPossibleDuplicateLeadAction(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  partnerFirstName: string;
  partnerLastName: string;
  partnerEmail: string;
}) {
  const { previewPossibleDuplicates } = await import("@/lib/leads/duplicate-review");
  return previewPossibleDuplicates(input);
}
