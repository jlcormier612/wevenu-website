/**
 * Ceremony / reception Smart Fields — lifecycle-aware source selection.
 *
 * PRE-BOOKING (events.booked_at is null): resolve from the lead's current
 * lead_event_space_preferences (venue-space name, external copy, or unlisted).
 *
 * POST-BOOKING (events.booked_at set): resolve from authoritative event
 * assignments / external event location fields only — never stale preferences.
 *
 * No planned-space, questionnaire, notes, or {{event_spaces}} fallback.
 */

export const CEREMONY_SPACE_UNLISTED = "Ceremony space is not listed yet.";
export const CEREMONY_OUTSIDE_VENUE = "Ceremony is listed as outside the venue.";
export const RECEPTION_SPACE_UNLISTED = "Reception space is not listed yet.";

export type CeremonyReceptionPreferenceSource = {
  kind: "venue_space" | "external" | "undecided";
  spaceName?: string | null;
  externalLocation?: string | null;
};

function resolveFromPreference(
  preference: CeremonyReceptionPreferenceSource | null | undefined,
  externalLockedCopy: string,
  unlisted: string,
): string {
  if (!preference || preference.kind === "undecided") return unlisted;
  if (preference.kind === "venue_space") {
    const name = preference.spaceName?.trim();
    return name || unlisted;
  }
  const external = preference.externalLocation?.trim();
  if (external) return externalLockedCopy;
  return unlisted;
}

/**
 * @param booked When true (default), use event assignment / external fields.
 *   When false, use lead preference source only.
 */
export function resolveCeremonySpace(opts: {
  booked?: boolean;
  assignmentName?: string | null;
  externalCeremonyLocation?: string | null;
  preference?: CeremonyReceptionPreferenceSource | null;
}): string {
  if (opts.booked === false) {
    return resolveFromPreference(
      opts.preference,
      CEREMONY_OUTSIDE_VENUE,
      CEREMONY_SPACE_UNLISTED,
    );
  }
  const name = opts.assignmentName?.trim();
  if (name) return name;
  const external = opts.externalCeremonyLocation?.trim();
  if (external) return CEREMONY_OUTSIDE_VENUE;
  return CEREMONY_SPACE_UNLISTED;
}

export function resolveReceptionSpace(opts: {
  booked?: boolean;
  assignmentName?: string | null;
  externalReceptionLocation?: string | null;
  preference?: CeremonyReceptionPreferenceSource | null;
}): string {
  if (opts.booked === false) {
    // Reception external uses the free-text location (not locked outside-venue copy).
    if (!opts.preference || opts.preference.kind === "undecided") {
      return RECEPTION_SPACE_UNLISTED;
    }
    if (opts.preference.kind === "venue_space") {
      const name = opts.preference.spaceName?.trim();
      return name || RECEPTION_SPACE_UNLISTED;
    }
    const external = opts.preference.externalLocation?.trim();
    return external || RECEPTION_SPACE_UNLISTED;
  }
  const name = opts.assignmentName?.trim();
  if (name) return name;
  const external = opts.externalReceptionLocation?.trim();
  if (external) return external;
  return RECEPTION_SPACE_UNLISTED;
}
