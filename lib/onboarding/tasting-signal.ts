/**
 * Optional tasting/appointment signal on onboarding intake.
 * Intake answers carry through once into the operational schedule catalog
 * (see applyOnboardingAppointmentCatalogOnce). They do not enable public booking.
 */

import { catalogHasEnabledOrdinaryAppointments } from "@/lib/calendar/onboarding-appointment-catalog-plan";
import type { VenueScheduleItemType } from "@/lib/calendar/schedule-item-catalog";

export function tastingAppointmentSignalLabel(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not answered";
}

/**
 * White Glove can finish the calendar stage when the venue does not need
 * tour scheduling and has no ordinary appointment types enabled in the
 * operational catalog. Unanswered intake is not treated as No.
 * Prefer catalog when loaded; fall back to intake Yes/No when catalog is empty/unavailable.
 */
export function whiteGloveCalendarCanBeFinished(input: {
  offersTours: boolean | null | undefined;
  offersTastingsOrAppointments?: boolean | null | undefined;
  catalog?: readonly VenueScheduleItemType[] | null;
}): boolean {
  if (input.offersTours !== false) return false;
  if (input.catalog && input.catalog.length > 0) {
    return !catalogHasEnabledOrdinaryAppointments(input.catalog);
  }
  return input.offersTastingsOrAppointments === false;
}
