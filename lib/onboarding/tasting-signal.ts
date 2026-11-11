/**
 * Optional tasting/appointment signal.
 * Yes tells an operator the venue offers them. It does not create
 * appointment types, scheduling rules, or booking configuration.
 */

export function tastingAppointmentSignalLabel(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not answered";
}

/**
 * White Glove can finish the calendar stage only when the customer
 * explicitly declined both tours and tastings/appointments.
 * Unanswered is not treated as No. Yes does not mean scheduling exists.
 */
export function whiteGloveCalendarCanBeFinished(input: {
  offersTours: boolean | null | undefined;
  offersTastingsOrAppointments: boolean | null | undefined;
}): boolean {
  return input.offersTours === false && input.offersTastingsOrAppointments === false;
}
