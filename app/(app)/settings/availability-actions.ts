"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

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
