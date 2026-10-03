/**
 * Lead space preference — historical lead intent by configured use key.
 * Preference is not a booking assignment.
 */
import type { VenueSpace } from "@/lib/availability/types";
import {
  resolveExperienceProfile,
  type ExperienceProfileDefinition,
} from "@/lib/event-experience";
import { spacesEligibleForUse } from "@/lib/venue-spaces/assignments";
import {
  allowsExternalLocation,
  relevantUsesForExperience,
} from "@/lib/venue-spaces/relevant-uses";
import type { SpaceOperatingMode } from "@/lib/venue-spaces/uses";

export const LEAD_SPACE_PREFERENCE_KINDS = ["venue_space", "external", "undecided"] as const;
export type LeadSpacePreferenceKind = (typeof LEAD_SPACE_PREFERENCE_KINDS)[number];

export type LeadEventSpacePreference = {
  useKey: string;
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

export function isLeadSpacePreferenceKind(value: string): value is LeadSpacePreferenceKind {
  return (LEAD_SPACE_PREFERENCE_KINDS as readonly string[]).includes(value);
}

export function venueOffersUse(spaces: VenueSpace[], useKey: string): boolean {
  return spacesEligibleForUse(spaces, useKey).length > 0;
}

export function shouldShowLeadSpacePreference(
  mode: SpaceOperatingMode | null | undefined,
  spaces: VenueSpace[],
  useKey: string,
  eventType?: string | null,
): boolean {
  if (mode !== "multi") return false;
  const relevant = relevantUsesForEventTypeSafe(spaces, eventType);
  if (!relevant.some((use) => use.key === useKey)) return false;
  return venueOffersUse(spaces, useKey);
}

function relevantUsesForEventTypeSafe(
  spaces: VenueSpace[],
  eventType?: string | null,
): Array<{ key: string; label: string }> {
  return relevantUsesForExperience(spaces, resolveExperienceProfile(eventType));
}

export function normalizeLeadSpacePreference(
  input: LeadSpacePreferenceInput,
  opts?: {
    allowedUseKeys?: readonly string[];
    profile?: Pick<ExperienceProfileDefinition, "isWeddingSpecific">;
  },
): { ok: true; value: LeadEventSpacePreference } | { ok: false; message: string } {
  const useKey = input.useKey.trim();
  const preferenceKind = input.preferenceKind.trim();
  if (!useKey || useKey.length > 48 || !/^[a-z0-9_]+$/.test(useKey)) {
    return { ok: false, message: "Space preference must use a configured space use." };
  }
  if (opts?.allowedUseKeys && !opts.allowedUseKeys.includes(useKey)) {
    return { ok: false, message: "That space preference is not available for this event." };
  }
  if (!isLeadSpacePreferenceKind(preferenceKind)) {
    return { ok: false, message: "Choose a venue space, an external location, or undecided." };
  }
  const spaceId = input.spaceId?.trim() || null;
  const externalLocation = input.externalLocation?.trim() || null;
  const profile = opts?.profile ?? resolveExperienceProfile("wedding");

  if (preferenceKind === "venue_space") {
    if (!spaceId) return { ok: false, message: "Choose a venue space." };
    if (externalLocation) {
      return { ok: false, message: "A venue-space preference cannot include an external location." };
    }
    return { ok: true, value: { useKey, preferenceKind, spaceId, externalLocation: null } };
  }
  if (preferenceKind === "external") {
    if (!allowsExternalLocation(useKey, profile)) {
      return { ok: false, message: "An external location is only available for ceremony or reception." };
    }
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
  useKey: string,
): { seedable: boolean; reason?: "inactive" | "disallowed" | "wrong_venue" } {
  if (space.venueId !== venueId) return { seedable: false, reason: "wrong_venue" };
  if (!space.isActive) return { seedable: false, reason: "inactive" };
  const uses = space.permittedUses ?? [];
  if (uses.length > 0 && !uses.includes(useKey)) return { seedable: false, reason: "disallowed" };
  return { seedable: true };
}

/**
 * Occupancy / book_relationship still need a single planned_event_space_id /
 * p_space_id anchor. Wedding: reception, else ceremony, else other venue-space.
 * Non-wedding: first relevant venue-space in relevant-use order.
 */
export function occupancyAnchorSpaceIdFromPreferences(
  prefs: ReadonlyArray<Pick<LeadEventSpacePreference, "useKey" | "preferenceKind" | "spaceId">>,
  opts?: { weddingFamily?: boolean; relevantUseKeys?: readonly string[] },
): string | null {
  const venueSpaces = prefs.filter(
    (p) => p.preferenceKind === "venue_space" && p.spaceId?.trim(),
  );
  const weddingFamily = opts?.weddingFamily !== false;
  if (weddingFamily) {
    const reception = venueSpaces.find((p) => p.useKey === "reception");
    if (reception?.spaceId?.trim()) return reception.spaceId.trim();
    const ceremony = venueSpaces.find((p) => p.useKey === "ceremony");
    if (ceremony?.spaceId?.trim()) return ceremony.spaceId.trim();
    return venueSpaces[0]?.spaceId?.trim() || null;
  }
  const order = opts?.relevantUseKeys;
  if (order && order.length > 0) {
    for (const key of order) {
      const match = venueSpaces.find((p) => p.useKey === key);
      if (match?.spaceId?.trim()) return match.spaceId.trim();
    }
    return null;
  }
  return venueSpaces[0]?.spaceId?.trim() || null;
}
