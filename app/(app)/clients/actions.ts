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
