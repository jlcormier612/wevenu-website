/**
 * Lead ceremony/reception space preference — historical lead intent.
 * Preference is not a booking assignment.
 */
import type { VenueSpace } from "@/lib/availability/types";
import { spacesEligibleForUse } from "@/lib/venue-spaces/assignments";
import type { SpaceOperatingMode } from "@/lib/venue-spaces/uses";

export const LEAD_SPACE_PREFERENCE_USE_KEYS = ["ceremony", "reception"] as const;
export type LeadSpacePreferenceUseKey = (typeof LEAD_SPACE_PREFERENCE_USE_KEYS)[number];

export const LEAD_SPACE_PREFERENCE_KINDS = ["venue_space", "external", "undecided"] as const;
export type LeadSpacePreferenceKind = (typeof LEAD_SPACE_PREFERENCE_KINDS)[number];

export type LeadEventSpacePreference = {
  useKey: LeadSpacePreferenceUseKey;
  preferenceKind: LeadSpacePreferenceKind;
  spaceId: string | null;
  externalLocation: string | null;
};

export type LeadSpacePreferenceInput = {
  useKey: string;
  preferenceKind: string;
  spaceId?: string | null;
  externalLocation?: string | null;
};

export function isLeadSpacePreferenceUseKey(value: string): value is LeadSpacePreferenceUseKey {
  return (LEAD_SPACE_PREFERENCE_USE_KEYS as readonly string[]).includes(value);
}

export function isLeadSpacePreferenceKind(value: string): value is LeadSpacePreferenceKind {
  return (LEAD_SPACE_PREFERENCE_KINDS as readonly string[]).includes(value);
}

export function venueOffersUse(spaces: VenueSpace[], useKey: string): boolean {
  return spacesEligibleForUse(spaces, useKey).length > 0;
}

/** Ceremony/reception preference UI is multi-mode only, and only when the venue offers that use. */
export function shouldShowLeadSpacePreference(
  mode: SpaceOperatingMode | null | undefined,
  spaces: VenueSpace[],
  useKey: LeadSpacePreferenceUseKey,
): boolean {
  if (mode !== "multi") return false;
  return venueOffersUse(spaces, useKey);
}

export function normalizeLeadSpacePreference(
  input: LeadSpacePreferenceInput,
): { ok: true; value: LeadEventSpacePreference } | { ok: false; message: string } {
  const useKey = input.useKey.trim();
  const preferenceKind = input.preferenceKind.trim();
  if (!isLeadSpacePreferenceUseKey(useKey)) {
    return { ok: false, message: "Space preference must be ceremony or reception." };
  }
  if (!isLeadSpacePreferenceKind(preferenceKind)) {
    return { ok: false, message: "Choose a venue space, an external location, or undecided." };
  }
  const spaceId = input.spaceId?.trim() || null;
  const externalLocation = input.externalLocation?.trim() || null;

  if (preferenceKind === "venue_space") {
    if (!spaceId) return { ok: false, message: "Choose a venue space." };
    if (externalLocation) {
      return { ok: false, message: "A venue-space preference cannot include an external location." };
    }
    return { ok: true, value: { useKey, preferenceKind, spaceId, externalLocation: null } };
  }
  if (preferenceKind === "external") {
    if (spaceId) {
      return { ok: false, message: "An external preference cannot include a venue space." };
    }
    if (!externalLocation) return { ok: false, message: "Enter the external location." };
    return { ok: true, value: { useKey, preferenceKind, spaceId: null, externalLocation } };
  }
  if (spaceId || externalLocation) {
    return { ok: false, message: "An undecided preference cannot include a space or location." };
  }
  return { ok: true, value: { useKey, preferenceKind, spaceId: null, externalLocation: null } };
}

export function spaceAllowsPreferenceUse(
  space: Pick<VenueSpace, "isActive" | "permittedUses" | "venueId">,
  venueId: string,
  useKey: LeadSpacePreferenceUseKey,
): { seedable: boolean; reason?: "inactive" | "disallowed" | "wrong_venue" } {
  if (space.venueId !== venueId) return { seedable: false, reason: "wrong_venue" };
  if (!space.isActive) return { seedable: false, reason: "inactive" };
  const uses = space.permittedUses ?? [];
  if (uses.length > 0 && !uses.includes(useKey)) return { seedable: false, reason: "disallowed" };
  return { seedable: true };
}

/**
 * Occupancy / book_relationship still need a single planned_event_space_id /
 * p_space_id anchor. Prefer reception venue-space, else ceremony — never invent
 * a second SoT; UI may hide the generic Event Space field in multi mode.
 */
export function occupancyAnchorSpaceIdFromPreferences(
  prefs: ReadonlyArray<Pick<LeadEventSpacePreference, "useKey" | "preferenceKind" | "spaceId">>,
): string | null {
  const reception = prefs.find(
    (p) => p.useKey === "reception" && p.preferenceKind === "venue_space" && p.spaceId?.trim(),
  );
  if (reception?.spaceId?.trim()) return reception.spaceId.trim();
  const ceremony = prefs.find(
    (p) => p.useKey === "ceremony" && p.preferenceKind === "venue_space" && p.spaceId?.trim(),
  );
  if (ceremony?.spaceId?.trim()) return ceremony.spaceId.trim();
  return null;
}
