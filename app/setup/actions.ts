"use server";

import { revalidatePath } from "next/cache";

import { submitVenueSetup, type SubmitSetupResult } from "@/lib/venue/service";
import type { VenueSetupInput } from "@/lib/venue/types";

/**
 * Server action entry point for the Venue Setup wizard. Thin by design — it
 * delegates all validation and persistence to the application service.
 */
export async function submitVenueSetupAction(
  input: VenueSetupInput,
): Promise<SubmitSetupResult> {
  const result = await submitVenueSetup(input);
  if (result.ok) {
    // Ensure the workspace layout re-evaluates venue gating on next navigation.
    revalidatePath("/", "layout");
  }
  return result;
}
