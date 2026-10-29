"use server";

import {
  updateVenueAppointmentOfferSignal,
} from "@/lib/onboarding/intake-service";
import type { AppointmentTypeKey } from "@/lib/onboarding/types";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export async function updateAppointmentOfferSignalAction(input: {
  offersAppointmentsOtherThanTours: boolean | null;
  appointmentTypeKeys?: AppointmentTypeKey[];
  appointmentTypesOther?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No active venue." };
  const role = await getCurrentUserRole();
  if (role !== "owner" && role !== "manager") {
    return { ok: false, message: "Only an Owner or Manager can update this." };
  }
  const result = await updateVenueAppointmentOfferSignal({
    venueId: venue.id,
    offersAppointmentsOtherThanTours: input.offersAppointmentsOtherThanTours,
    appointmentTypeKeys: input.appointmentTypeKeys,
    appointmentTypesOther: input.appointmentTypesOther,
  });
  if (!result.ok) return { ok: false, message: result.error };
  return { ok: true };
}
