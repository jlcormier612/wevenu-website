"use server";

import { revalidatePath } from "next/cache";

import { dismissOnboarding } from "@/lib/venue/service";

/**
 * Server action: permanently dismiss the Getting Started card for this venue.
 * Called from the form in the GettingStartedCard component.
 */
export async function dismissOnboardingAction(): Promise<void> {
  await dismissOnboarding();
  revalidatePath("/dashboard");
}
