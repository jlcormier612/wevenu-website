"use server";

import { revalidatePath } from "next/cache";

import { dismissOnboarding } from "@/lib/venue/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { markMilestoneShown } from "@/lib/activation/service";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Server action: permanently dismiss the Getting Started card for this venue.
 * Called from the form in the GettingStartedCard component.
 */
export async function dismissOnboardingAction(): Promise<void> {
  await dismissOnboarding();
  revalidatePath("/dashboard");
}

export async function markMilestoneShownAction(milestoneId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  await markMilestoneShown(venue.id, milestoneId);
}

export async function dismissDigestIntroAction(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("venue_notification_preferences") as any)
    .update({ digest_intro_dismissed: true })
    .eq("venue_id", venue.id);
}
