"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
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
  // Stage 1F — ending an HTC support session is required before ordinary
  // membership selection. Support context overrides current_user_venue_id(),
  // which otherwise makes select-venue appear to do nothing (set Fancy, still
  // resolve the support venue → needs_selection loop).
  try {
    const supabase = await createClient();
    await supabase.rpc("htc_end_support_context");
  } catch {
    // Best-effort: setActiveVenue still runs if RPC is unavailable mid-migration.
  }

  const result = await setActiveVenue(venueId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/", "layout");
  return { ok: true };
}
