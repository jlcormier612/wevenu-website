/**
 * Setup Hub category completion — satisfied outcomes from authoritative data.
 * Not visit history. ready_to_invite_couples is independent and is not used here.
 */
import type { BusinessHourInput } from "@/lib/venue/types";
import type { SpaceOperatingMode } from "@/lib/venue-spaces/uses";
import { CHANNEL_HAS_VERIFICATION } from "@/lib/setup-hub/types";
import type { LeadCaptureChannelState, SetupHubState } from "@/lib/setup-hub/types";

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** Fields named by the Your Venue card — not Venue Guide, type, capacity, or legal name. */
export type YourVenueFacts = {
  name: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
  businessHours: readonly BusinessHourInput[];
  logoUrl: string | null | undefined;
  heroImageUrl: string | null | undefined;
  primaryColor: string | null | undefined;
};

export function hasConfiguredBusinessHours(hours: readonly BusinessHourInput[]): boolean {
  return hours.some((h) => h.isOpen && Boolean(h.openTime?.trim()) && Boolean(h.closeTime?.trim()));
}

export function isYourVenueComplete(facts: YourVenueFacts): boolean {
  return (
    filled(facts.name) &&
    filled(facts.email) &&
    filled(facts.phone) &&
    hasConfiguredBusinessHours(facts.businessHours) &&
    filled(facts.logoUrl) &&
    filled(facts.heroImageUrl) &&
    filled(facts.primaryColor)
  );
}

export function isCalendarAvailabilityComplete(input: {
  spaceOperatingMode: SpaceOperatingMode | null | undefined;
  spacesCount: number;
}): boolean {
  if (input.spaceOperatingMode === "multi") return input.spacesCount >= 1;
  return true;
}

export function isBringYourBusinessComplete(input: {
  hasImportedData: boolean;
  path: SetupHubState["bringYourBusinessPath"];
}): boolean {
  return input.hasImportedData || input.path === "individual" || input.path === "skipped";
}

export function isYourOfferingsComplete(input: {
  authoredPackageCount: number;
  authoredInventoryCount: number;
  reviewedAt: string | null | undefined;
}): boolean {
  return input.authoredPackageCount + input.authoredInventoryCount > 0 || Boolean(input.reviewedAt);
}

export function isClientExperienceComplete(input: {
  authoredTemplateCount: number;
  reviewedAt: string | null | undefined;
}): boolean {
  return input.authoredTemplateCount > 0 || Boolean(input.reviewedAt);
}

/**
 * Approved lead-capture model: verified automated channel where practical,
 * or explicit manual/external path. Not embed_key alone. Not ready_to_invite_couples.
 */
export function isLeadCaptureComplete(
  path: SetupHubState["leadCapturePath"],
  channels: readonly LeadCaptureChannelState[],
): boolean {
  if (path === "manual_external") return true;
  if (path !== "automated") return false;
  return channels.some((c) => {
    if (!c.configuredAt) return false;
    if (CHANNEL_HAS_VERIFICATION[c.channel]) return c.verifiedAt != null;
    return true;
  });
}

/** Solo owner is enough. Extra teammates stay complete. Visit is irrelevant. */
export function isYourPeopleComplete(input: {
  additionalTeamCount: number;
  hasActiveOwner: boolean;
  soloConfirmed: boolean;
}): boolean {
  return input.additionalTeamCount > 0 || input.hasActiveOwner || input.soloConfirmed;
}

export function isFinancialsComplete(input: {
  stripeConnected: boolean;
  reviewedAt: string | null | undefined;
}): boolean {
  return input.stripeConnected || Boolean(input.reviewedAt);
}
