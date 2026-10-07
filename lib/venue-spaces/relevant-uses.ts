/**
 * Which configured venue uses are relevant to ask about for this event.
 * Capabilities stay on venue_spaces.permitted_uses; this only filters.
 */
import type { VenueSpace } from "@/lib/availability/types";
import {
  resolveExperienceProfile,
  type ExperienceProfileDefinition,
} from "@/lib/event-experience";
import { configuredUsesFromSpaces } from "@/lib/venue-spaces/assignments";

/**
 * Wedding-only uses already in SUGGESTED_SPACE_USES — not a new vocabulary.
 * Ceremony and reception are venue capabilities, not wedding-only keys.
 */
export const WEDDING_OCCASION_USE_KEYS = [
  "getting_ready",
  "rehearsal_dinner",
] as const;

/**
 * Wedding Space Preferences — event components at the venue, not event types.
 * Conference/meeting/dining stay available for corporate and other non-wedding flows.
 */
export const WEDDING_SPACE_COMPONENT_KEYS = [
  "ceremony",
  "reception",
  "cocktail_hour",
  "getting_ready",
  "rehearsal_dinner",
] as const;

export type WeddingOccasionUseKey = (typeof WEDDING_OCCASION_USE_KEYS)[number];

export function isWeddingOccasionUseKey(useKey: string): boolean {
  return (WEDDING_OCCASION_USE_KEYS as readonly string[]).includes(useKey);
}

export function isWeddingSpaceComponentKey(useKey: string): boolean {
  return (WEDDING_SPACE_COMPONENT_KEYS as readonly string[]).includes(useKey);
}

export function relevantUsesForExperience(
  spaces: VenueSpace[],
  profile: Pick<ExperienceProfileDefinition, "isWeddingSpecific">,
): Array<{ key: string; label: string }> {
  const configured = configuredUsesFromSpaces(spaces);
  if (profile.isWeddingSpecific) {
    return configured.filter((use) => isWeddingSpaceComponentKey(use.key));
  }
  return configured.filter((use) => !isWeddingOccasionUseKey(use.key));
}

export function relevantUsesForEventType(
  spaces: VenueSpace[],
  eventType: string | null | undefined,
): Array<{ key: string; label: string }> {
  return relevantUsesForExperience(spaces, resolveExperienceProfile(eventType));
}

export function allowsExternalLocation(
  useKey: string,
  profile: Pick<ExperienceProfileDefinition, "isWeddingSpecific">,
): boolean {
  return profile.isWeddingSpecific && (useKey === "ceremony" || useKey === "reception");
}
