"use server";

import { revalidatePath } from "next/cache";

import { deleteVenueSetupProfile, saveVenueSetupProfile } from "@/lib/event-setup/profiles";
import type { SetupDecisions } from "@/lib/event-setup/state";
import type { SetupTemplateRefs } from "@/lib/event-setup/profile";
import { applicableSetupSteps } from "@/lib/event-setup/state";
import { getCurrentVenue } from "@/lib/venue/service";

function revalidate() {
  revalidatePath("/settings/leads/setup-profiles");
  revalidatePath("/settings/leads");
}

export async function saveSetupProfileAction(input: {
  id?: string | null;
  name: string;
  decisions: SetupDecisions;
  templateRefs: SetupTemplateRefs;
  eventTypes: string[];
  venueDefault: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const result = await saveVenueSetupProfile({
    ...input,
    applicable: applicableSetupSteps({
      timeline: venue.planningTimelineEnabled,
      floorPlan: venue.planningFloorPlanEnabled,
      seating: venue.planningSeatingEnabled,
      vendors: venue.planningVendorsEnabled,
    }),
  });
  if (result.ok) revalidate();
  return result.ok ? { ok: true } : result;
}

export async function deleteSetupProfileAction(
  profileId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await deleteVenueSetupProfile(profileId);
  if (result.ok) revalidate();
  return result;
}
