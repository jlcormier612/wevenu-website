"use server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { submitOnboardingIntake } from "@/lib/onboarding/intake-service";
import type { OnboardingIntakeInput } from "@/lib/onboarding/types";
import { getCurrentVenue } from "@/lib/venue/service";

export async function submitSelfSetupIntakeAction(
  intake: OnboardingIntakeInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };

  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("venue_enrollments")
    .select("id")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  const result = await submitOnboardingIntake({
    venueId: venue.id,
    enrollmentId: enrollment?.id ?? null,
    path: "self_setup",
    intake,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
