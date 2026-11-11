"use server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { submitOnboardingIntake } from "@/lib/onboarding/intake-service";
import {
  getEnrollmentOwnershipForVenue,
  isPurchaserSetupPerson,
} from "@/lib/onboarding/initial-ownership";
import type { OnboardingIntakeInput } from "@/lib/onboarding/types";
import { getCurrentVenue } from "@/lib/venue/service";

export async function declarePurchaserOwnershipAction(input: {
  isOwner: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const venue = await getCurrentVenue();
  const membership = await getActiveVenueMembership();
  if (!venue || !membership) return { ok: false, error: "No venue found." };

  const enrollment = await getEnrollmentOwnershipForVenue(venue.id);
  if (!isPurchaserSetupPerson(enrollment, membership.email)) {
    return { ok: false, error: "Only the person setting up this account can answer this." };
  }
  if (enrollment?.purchaser_is_owner !== null) {
    return { ok: true };
  }

  const admin = createAdminClient();
  const { error: enrollErr } = await admin
    .from("venue_enrollments")
    .update({ purchaser_is_owner: input.isOwner })
    .eq("id", enrollment!.id);
  if (enrollErr) return { ok: false, error: enrollErr.message };

  if (input.isOwner) {
    const { error } = await admin
      .from("venue_staff")
      .update({
        is_owner: true,
        owner_invite_pending: false,
      })
      .eq("id", membership.staffId)
      .eq("venue_id", venue.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const overrides = {
      ...(membership.overrides ?? {}),
      "account.billing": true,
    };
    const { error } = await admin
      .from("venue_staff")
      .update({
        is_owner: false,
        owner_invite_pending: false,
        access_title: "administrator",
        title_basis: "administrator",
        capability_overrides: overrides,
      })
      .eq("id", membership.staffId)
      .eq("venue_id", venue.id);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

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
