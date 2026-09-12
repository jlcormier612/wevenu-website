"use server";

import { revalidatePath } from "next/cache";

import { startBookingFileAction } from "@/app/(app)/booking-journey/actions";
import { createClient_ } from "@/lib/clients/service";
import type { ClientInput, CreateClientResult } from "@/lib/clients/types";
import type { Lead } from "@/lib/leads/types";

export async function createClientAction(input: ClientInput): Promise<CreateClientResult> {
  const result = await createClient_(input);
  if (result.ok) revalidatePath("/clients");
  return result;
}

/** Venue-side strong-signal possible match preview — never blocks create. */
export async function previewPossibleDuplicateClientAction(input: {
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

/**
 * @deprecated Prefer startBookingFileAction — canonical Lead → Booking Started path.
 * Delegates to startBookingFileAction so behavior cannot diverge.
 */
export async function convertLeadToClientAction(
  lead: Lead,
  spaceId?: string,
): Promise<CreateClientResult> {
  return startBookingFileAction(lead, spaceId);
}
