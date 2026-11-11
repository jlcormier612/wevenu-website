/**
 * Guarded hard-delete for tour_appointments.
 *
 * Archive is the normal cleanup path. Hard delete is only for disposable /
 * orphan / junk rows. Server must enforce this — UI hiding is not enough.
 *
 * Meaningful customer tours (linked to a real lead, non-synthetic contact)
 * must not be hard-deleted: that mutates reporting funnel/tour counts and
 * leaves orphan post-tour narrative on the lead.
 */

export type TourDeleteGuardInput = {
  leadId: string | null | undefined;
  contactEmail: string | null | undefined;
  contactName: string | null | undefined;
};

export type TourDeleteGuardResult =
  | { allowed: true; reason: "orphan" | "synthetic_fixture" }
  | { allowed: false; reason: string };

const SYNTHETIC_EMAIL =
  /@(example\.com|example\.test)$/i;
const SYNTHETIC_NAME =
  /\b(e2e|eprotect|jenfancy|test\s*tour|synthetic)\b/i;

export function isDisposableTourContact(
  contactEmail: string | null | undefined,
  contactName: string | null | undefined,
): boolean {
  const email = (contactEmail ?? "").trim();
  const name = (contactName ?? "").trim();
  if (email && SYNTHETIC_EMAIL.test(email)) return true;
  if (name && SYNTHETIC_NAME.test(name)) return true;
  return false;
}

/** Pure guard used by the server action and by the Tours UI. */
export function canHardDeleteTourAppointment(
  tour: TourDeleteGuardInput,
): TourDeleteGuardResult {
  const leadId = tour.leadId ?? null;
  if (!leadId) {
    return { allowed: true, reason: "orphan" };
  }
  if (isDisposableTourContact(tour.contactEmail, tour.contactName)) {
    return { allowed: true, reason: "synthetic_fixture" };
  }
  return {
    allowed: false,
    reason:
      "This tour is linked to a customer record. Use Archive to remove it from the working list. Hard delete is only for disposable or orphan tours.",
  };
}
