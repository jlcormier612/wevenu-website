"use server";

import { revalidatePath } from "next/cache";

import {
  getStarterProvisioningSnapshot,
  restoreHtcStarters,
  type StarterProvisioningSnapshot,
  type StarterSeedResult,
} from "@/lib/provisioning/starters";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

function revalidateStarterSurfaces() {
  revalidatePath("/library");
  revalidatePath("/setup-hub");
  revalidatePath("/packages");
}

export async function getCurrentVenueStarterProvisioningAction(): Promise<StarterProvisioningSnapshot | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return getStarterProvisioningSnapshot(venue.id);
}

export async function restoreHtcStartersAction(opts?: {
  recreateDeleted?: boolean;
}): Promise<
  | { ok: true; result: StarterSeedResult }
  | { ok: false; message: string }
> {
  const venue = await getCurrentVenue();
  if (!venue) {
    return { ok: false, message: "Venue not found." };
  }
  const role = await getCurrentUserRole();
  if (role !== "owner" && role !== "manager") {
    return { ok: false, message: "Only owners and managers can restore starters." };
  }

  try {
    const result = await restoreHtcStarters(venue.id, {
      recreateDeleted: opts?.recreateDeleted === true,
    });
    revalidateStarterSurfaces();
    return { ok: true, result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "We couldn't restore starters right now.";
    return { ok: false, message };
  }
}
