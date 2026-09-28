/**
 * Venue identity: customer-facing name vs legal business name.
 *
 * Settings (Business & Brand):
 *   venues.name           = Venue name (customer-facing)
 *   venues.business_name  = Legal business name — "Used on contracts and invoices."
 *
 * Do not substitute legal business name into customer-facing Proposal
 * communications. Do not substitute venue name into legal documents.
 */

export type VenueIdentityFields = {
  name?: string | null;
  businessName?: string | null;
};

/** Customer-facing venue name. Never falls back to legal business name. */
export function customerFacingVenueName(venue: VenueIdentityFields): string {
  const name = venue.name?.trim();
  return name || "Your venue";
}

/** Legal / accounting document name. Falls back to venue name when legal is blank. */
export function legalDocumentVenueName(venue: VenueIdentityFields): string {
  const legal = venue.businessName?.trim();
  if (legal) return legal;
  return customerFacingVenueName(venue);
}
