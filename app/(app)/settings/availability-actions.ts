"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export async function updateHoldBlocksAvailabilityAction(
  holdBlocksAvailability: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof holdBlocksAvailability !== "boolean") {
    return { ok: false, message: "Choose whether holds close public dates." };
  }
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("venues")
    .update({ hold_blocks_availability: holdBlocksAvailability })
    .eq("id", venue.id);
  if (error) return { ok: false, message: "Could not save this availability preference." };
  revalidatePath("/settings/availability");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function updateAllowSimultaneousPublicAvailabilityAction(
  allow: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof allow !== "boolean") {
    return { ok: false, message: "Choose whether confirmed events close the whole day for public availability." };
  }
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const role = await getCurrentUserRole();
  // venues UPDATE RLS is still owner_user_id-scoped; managers (and some
  // owner sessions) need a verified staff write path for this preference.
  if (role !== "owner" && role !== "manager") {
    return { ok: false, message: "Only an Owner or Manager can change this preference." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venues")
    .update({ allow_simultaneous_public_availability: allow })
    .eq("id", venue.id)
    .select("allow_simultaneous_public_availability")
    .maybeSingle<{ allow_simultaneous_public_availability: boolean }>();
  if (error || data?.allow_simultaneous_public_availability !== allow) {
    return { ok: false, message: "Could not save this availability preference." };
  }
  revalidatePath("/settings/availability");
  revalidatePath("/calendar");
  revalidatePath("/form");
  return { ok: true };
}

export async function updateAllowToursDuringBookedEventsAction(
  allow: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof allow !== "boolean") {
    return { ok: false, message: "Choose whether tours can overlap a booked event." };
  }
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("venues")
    .update({ allow_tours_during_booked_events: allow })
    .eq("id", venue.id);
  if (error) return { ok: false, message: "Could not save this availability preference." };
  revalidatePath("/settings/availability");
  revalidatePath("/calendar");
  return { ok: true };
}
