"use server";

import { revalidatePath } from "next/cache";

import {
  listMyVenueMemberships,
  setActiveVenue,
  type VenueMembershipSummary,
} from "@/lib/venue/active-context";

export async function listVenueMembershipsAction(): Promise<VenueMembershipSummary[]> {
  return listMyVenueMemberships();
}

export async function selectActiveVenueAction(
  venueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await setActiveVenue(venueId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/", "layout");
  return { ok: true };
}
