"use server";

import { revalidatePath } from "next/cache";

import { deleteVenueSetupProfile, saveVenueSetupProfile } from "@/lib/event-setup/profiles";
import type { SetupDecisions } from "@/lib/event-setup/state";
import type { SetupTemplateRefs } from "@/lib/event-setup/profile";
import type {
  SetupProfileAssignmentConflict,
  SetupProfileConflictAck,
} from "@/lib/event-setup/setup-profile-event-types";
import { applicableSetupSteps } from "@/lib/event-setup/state";
import { capabilitiesFromVenue } from "@/lib/playbooks/capabilities";
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
  confirmedConflicts?: SetupProfileConflictAck[];
}): Promise<
  | { ok: true }
  | { ok: false; message: string }
  | { ok: false; code: "assignment_conflicts"; conflicts: SetupProfileAssignmentConflict[] }
> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const result = await saveVenueSetupProfile({
    ...input,
    applicable: applicableSetupSteps(capabilitiesFromVenue(venue)),
  });
  if (result.ok) revalidate();
  if (result.ok) return { ok: true };
  return result;
}

export async function deleteSetupProfileAction(
  profileId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await deleteVenueSetupProfile(profileId);
  if (result.ok) revalidate();
  return result;
}
