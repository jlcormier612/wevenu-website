/**
 * Timeline audience selection follows Ownership — who may choose which
 * audiences. The vocabulary itself (venue|client|wedding_party|guests|vendors)
 * is unchanged; this module only gates selection by owner.
 */
import type { TimelineAudience, TimelineOwner } from "@/lib/timeline/types";

export const VENUE_OWNED_ALLOWED_AUDIENCES: readonly TimelineAudience[] = [
  "client",
  "vendors",
];

export const CLIENT_OWNED_ALLOWED_AUDIENCES: readonly TimelineAudience[] = [
  "venue",
  "vendors",
  "guests",
  "wedding_party",
];

/** New venue-owned items default to sharing with the couple (framework). */
export const VENUE_OWNED_DEFAULT_AUDIENCES: TimelineAudience[] = ["client"];

/** New client-owned items stay private until the couple chooses audiences. */
export const CLIENT_OWNED_DEFAULT_AUDIENCES: TimelineAudience[] = [];

const VENUE_ALLOWED = new Set<string>(VENUE_OWNED_ALLOWED_AUDIENCES);
const CLIENT_ALLOWED = new Set<string>(CLIENT_OWNED_ALLOWED_AUDIENCES);

export type AudienceSanitizeResult =
  | { ok: true; audiences: TimelineAudience[] }
  | { ok: false; message: string; rejected: string[] };

function uniquePreserveOrder(values: TimelineAudience[]): TimelineAudience[] {
  const seen = new Set<string>();
  const out: TimelineAudience[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Venue-owned items may only share with Client and Vendors.
 * Rejects wedding_party, guests, venue, and any unknown tag.
 * Empty array is allowed (venue-private). Undefined → default Client.
 */
export function sanitizeVenueOwnedAudiences(
  audiences: TimelineAudience[] | undefined,
): AudienceSanitizeResult {
  const input = audiences === undefined ? [...VENUE_OWNED_DEFAULT_AUDIENCES] : audiences;
  const rejected = input.filter((a) => !VENUE_ALLOWED.has(a));
  if (rejected.length > 0) {
    return {
      ok: false,
      message: `Venue-owned timeline items cannot share with: ${rejected.join(", ")}.`,
      rejected,
    };
  }
  return { ok: true, audiences: uniquePreserveOrder(input) };
}

/**
 * Client-owned items may share with Venue, Vendors, Guests, Wedding Party
 * in any combination (including none). Rejects client and unknown tags.
 */
export function sanitizeClientOwnedAudiences(
  audiences: TimelineAudience[] | undefined,
): AudienceSanitizeResult {
  const input = audiences === undefined ? [...CLIENT_OWNED_DEFAULT_AUDIENCES] : audiences;
  const rejected = input.filter((a) => !CLIENT_ALLOWED.has(a));
  if (rejected.length > 0) {
    return {
      ok: false,
      message: `Client-owned timeline items cannot share with: ${rejected.join(", ")}.`,
      rejected,
    };
  }
  return { ok: true, audiences: uniquePreserveOrder(input) };
}

export function sanitizeAudiencesForOwner(
  owner: TimelineOwner,
  audiences: TimelineAudience[] | undefined,
): AudienceSanitizeResult {
  return owner === "venue"
    ? sanitizeVenueOwnedAudiences(audiences)
    : sanitizeClientOwnedAudiences(audiences);
}

/** True when a venue-owned item should appear in the couple portal. */
export function venueItemVisibleToClient(audiences: readonly string[]): boolean {
  return audiences.includes("client");
}

/** Projection helpers — receiving surfaces filter on these tags. */
export function visibleToVendors(audiences: readonly string[]): boolean {
  return audiences.includes("vendors");
}

export function visibleToGuests(audiences: readonly string[]): boolean {
  return audiences.includes("guests");
}

export function visibleToWeddingParty(audiences: readonly string[]): boolean {
  return audiences.includes("wedding_party");
}

export function visibleToVenueAudience(audiences: readonly string[]): boolean {
  return audiences.includes("venue");
}
