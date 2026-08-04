/**
 * Product → CRM write-back.
 *
 * When a venue completes/updates setup in the product app, push Venue /
 * Owner Details onto the linked Relationship so CS sees live profile data.
 */

import {
  splitPersonName,
  syncRelationshipFromProduct,
  type RelationshipFieldPatch,
  type SyncRelationshipFromProductResult,
} from "../relationships";

export type ProductVenueProfileFields = {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  address?: string | null;
  venueType?: string | null;
  capacity?: number | null;
  ownerFullName?: string | null;
  ownerEmail?: string | null;
  ownerTitle?: string | null;
  /** Owner contact phone when available; venue business phone is fine. */
  ownerPhone?: string | null;
};

export type SyncVenueProfileReason =
  | "setup_progress"
  | "setup_submit"
  | "settings";

export type SyncVenueProfileFromProductInput = {
  /** Real Supabase venue id (or stable sim id once provisioning writes one). */
  venueId: string;
  profile: ProductVenueProfileFields;
  stripeCustomerId?: string | null;
  reason: SyncVenueProfileReason;
};

export type SyncVenueProfileFromProductResult =
  | { ok: true; synced: false; reason: "no_link" | "empty_profile" }
  | ({ ok: true; synced: true } & SyncRelationshipFromProductResult)
  | { ok: false; error: string };

function normalizeWebsite(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function buildPatch(profile: ProductVenueProfileFields): RelationshipFieldPatch {
  const { firstName, lastName } = splitPersonName(profile.ownerFullName);
  const capacity =
    typeof profile.capacity === "number" && Number.isFinite(profile.capacity)
      ? Math.max(0, Math.round(profile.capacity))
      : undefined;

  return {
    venueName: profile.name?.trim() || undefined,
    city: profile.city?.trim() || undefined,
    state: profile.state?.trim() || undefined,
    website: normalizeWebsite(profile.website),
    address: profile.address?.trim() || undefined,
    venueType: profile.venueType?.trim() || undefined,
    capacity,
    ownerFirstName: firstName || undefined,
    ownerLastName: lastName || undefined,
    ownerEmail: profile.ownerEmail?.trim() || undefined,
    ownerTitle: profile.ownerTitle?.trim() || undefined,
    ownerPhone: profile.ownerPhone?.trim() || undefined,
  };
}

/**
 * Push product venue/owner profile onto the linked CRM Relationship.
 * Prefer `productSync.venueId`; fall back to owner email / Stripe customer.
 * Never creates a Relationship. Failures are soft — callers should catch.
 */
export async function syncVenueProfileFromProduct(
  input: SyncVenueProfileFromProductInput,
): Promise<SyncVenueProfileFromProductResult> {
  const venueId = input.venueId?.trim();
  if (!venueId) {
    return { ok: false, error: "venueId is required" };
  }

  const patch = buildPatch(input.profile);
  const hasPatch = Object.values(patch).some(
    (v) => v != null && String(v).trim() !== "",
  );
  if (!hasPatch) {
    return { ok: true, synced: false, reason: "empty_profile" };
  }

  try {
    const timeline =
      input.reason === "setup_progress"
        ? {
            title: "Venue profile updated from product",
            body: "Setup progress synced venue details into CRM.",
            // Mid-wizard autosaves are frequent — keep the timeline quiet.
            debounceMs: 30 * 60 * 1000,
          }
        : input.reason === "setup_submit"
          ? {
              title: "Venue profile updated from product",
              body: "Venue setup completed — CRM Details refreshed from product.",
              debounceMs: 0,
            }
          : {
              title: "Venue profile updated from product",
              body: "Venue settings saved in product — CRM Details refreshed.",
              debounceMs: 5 * 60 * 1000,
            };

    const result = await syncRelationshipFromProduct({
      productVenueId: venueId,
      email: input.profile.ownerEmail,
      stripeCustomerId: input.stripeCustomerId,
      patch,
      bindProductVenueId: true,
      timeline,
    });

    if (!result) {
      return { ok: true, synced: false, reason: "no_link" };
    }

    return { ok: true, synced: true, ...result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Product → CRM write-back failed";
    return { ok: false, error: message };
  }
}
