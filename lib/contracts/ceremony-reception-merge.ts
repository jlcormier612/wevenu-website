/**
 * Booked-event ceremony / reception Smart Fields.
 * Assignment name wins; otherwise the event external-location field;
 * otherwise locked empty copy. No planned-space, preference, questionnaire,
 * or {{event_spaces}} fallback.
 */

export const CEREMONY_SPACE_UNLISTED = "Ceremony space is not listed yet.";
export const CEREMONY_OUTSIDE_VENUE = "Ceremony is listed as outside the venue.";
export const RECEPTION_SPACE_UNLISTED = "Reception space is not listed yet.";

export function resolveCeremonySpace(opts: {
  assignmentName?: string | null;
  externalCeremonyLocation?: string | null;
}): string {
  const name = opts.assignmentName?.trim();
  if (name) return name;
  const external = opts.externalCeremonyLocation?.trim();
  if (external) return CEREMONY_OUTSIDE_VENUE;
  return CEREMONY_SPACE_UNLISTED;
}

export function resolveReceptionSpace(opts: {
  assignmentName?: string | null;
  externalReceptionLocation?: string | null;
}): string {
  const name = opts.assignmentName?.trim();
  if (name) return name;
  const external = opts.externalReceptionLocation?.trim();
  if (external) return external;
  return RECEPTION_SPACE_UNLISTED;
}
