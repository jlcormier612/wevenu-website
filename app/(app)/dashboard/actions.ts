"use server";

import { revalidatePath } from "next/cache";

import { dismissDashboardAttentionItem } from "@/lib/dashboard-system/attention-dismiss";
import { dismissOnboarding, markLuvIntroSeen, getCurrentVenue } from "@/lib/venue/service";
import { markMilestoneShown } from "@/lib/activation/service";
import { isSupabaseConfigured } from "@/lib/env";

export async function dismissDashboardAttentionAction(
  itemKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await dismissDashboardAttentionItem(itemKey);
  if (result.ok) revalidatePath("/dashboard");
  return result;
}

/**
 * Server action: permanently dismiss the legacy Getting Started onboarding
 * flag. The Dashboard no longer renders that card (Your Next Steps replaced
 * it); this remains so the venue flag can still be cleared if needed.
 */
export async function dismissOnboardingAction(): Promise<void> {
  await dismissOnboarding();
  revalidatePath("/dashboard");
}

/** Luv Experience Completion, Work Stream 5 — dismiss the one-time intro card. */
export async function markLuvIntroSeenAction(): Promise<void> {
  await markLuvIntroSeen();
  revalidatePath("/dashboard");
}

export async function markMilestoneShownAction(milestoneId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  await markMilestoneShown(venue.id, milestoneId);
}
