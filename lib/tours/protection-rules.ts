export type TourProtectionMode = "none" | "setup" | "fee";

export type TourProtectionRequestStatus =
  | "pending"
  | "checkout_open"
  | "completed"
  | "paid_unbooked"
  | "abandoned"
  | "expired"
  | "failed"
  | "refunded";

export type ConnectEligibleVenue = {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
};

export type TourProtectionConfig = ConnectEligibleVenue & {
  tourProtectionMode: TourProtectionMode;
  tourProtectionFeeCents: number;
};

export function isConnectEligible(venue: ConnectEligibleVenue): boolean {
  return Boolean(venue.stripeAccountId) && venue.stripeChargesEnabled === true;
}

export function isTourProtectionRequired(venue: TourProtectionConfig): boolean {
  if (!isConnectEligible(venue)) return false;
  if (venue.tourProtectionMode === "setup") return true;
  if (venue.tourProtectionMode === "fee" && venue.tourProtectionFeeCents > 0) return true;
  return false;
}

export function tourProtectionKind(
  venue: TourProtectionConfig,
): "setup" | "fee" | null {
  if (!isTourProtectionRequired(venue)) return null;
  return venue.tourProtectionMode === "fee" ? "fee" : "setup";
}

/** Webhook routing key — request id is carried as htc_payment_line_item_id. */
export const TOUR_PROTECTION_KIND = "tour_protection";

export function isTourProtectionMetadata(meta: {
  htc_kind?: string | null;
  htc_tour_protection_request_id?: string | null;
}): boolean {
  return meta.htc_kind === TOUR_PROTECTION_KIND || Boolean(meta.htc_tour_protection_request_id);
}

export function webhookVenueMatchesRequest(opts: {
  requestVenueId: string;
  connectedAccountVenueId: string | null;
  metadataVenueId: string | null | undefined;
}): boolean {
  if (!opts.connectedAccountVenueId) return false;
  if (opts.requestVenueId !== opts.connectedAccountVenueId) return false;
  if (opts.metadataVenueId && opts.metadataVenueId !== opts.requestVenueId) return false;
  return true;
}

export function canRefundTourFee(role: string | null): boolean {
  return role === "owner" || role === "manager";
}

export function canRefundEventPayment(role: string | null): boolean {
  return role === "owner";
}
