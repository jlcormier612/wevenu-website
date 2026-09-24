"use server";

import { revalidatePath } from "next/cache";

import {
  DEFAULT_COMMERCIAL_BOOKING_PREFS,
  normalizeCommercialBookingPrefs,
  type VenueCommercialBookingPrefs,
} from "@/lib/booking-journey/venue-prefs";
import { validateCustomScheduleTemplate } from "@/lib/payments/custom-default-schedule";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import { updateVenueFields } from "@/lib/venue/repository";

export async function saveCommercialBookingPrefsAction(
  input: Partial<VenueCommercialBookingPrefs>,
): Promise<{ ok: true; prefs: VenueCommercialBookingPrefs } | { ok: false; message: string }> {
  const role = await getCurrentUserRole();
  if (role !== "owner" && role !== "manager") {
    return { ok: false, message: "Only owners and managers can change booking preferences." };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Venue not found." };

  if (
    input.remainingBalanceMode === "plan"
    && input.defaultSchedulePresetId === "custom"
  ) {
    const v = validateCustomScheduleTemplate(input.defaultCustomSchedule);
    if (!v.ok) {
      return { ok: false, message: v.errors[0] ?? "Fix your Custom payment schedule before saving." };
    }
  }

  const prefs = normalizeCommercialBookingPrefs({
    ...DEFAULT_COMMERCIAL_BOOKING_PREFS,
    ...venue.commercialBookingPrefs,
    ...input,
  });

  if (prefs.defaultSchedulePresetId === "custom") {
    const v = validateCustomScheduleTemplate(prefs.defaultCustomSchedule);
    if (!v.ok) {
      return { ok: false, message: v.errors[0] ?? "Fix your Custom payment schedule before saving." };
    }
  }

  const supabase = await createClient();
  await updateVenueFields(supabase, venue.id, {
    commercial_booking_prefs: prefs,
  });

  revalidatePath("/settings/leads");
  revalidatePath("/leads");
  revalidatePath("/clients");
  return { ok: true, prefs };
}
