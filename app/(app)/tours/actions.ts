"use server";

import {
  deleteTourAppointment,
  setTourAppointmentArchived,
  type TourArchiveActionResult,
  type TourDeleteActionResult,
} from "@/lib/tours/service";

export async function setTourArchivedAction(
  appointmentId: string,
  isArchived: boolean,
): Promise<TourArchiveActionResult> {
  return setTourAppointmentArchived(appointmentId, isArchived);
}

export async function deleteTourAction(
  appointmentId: string,
): Promise<TourDeleteActionResult> {
  return deleteTourAppointment(appointmentId);
}
