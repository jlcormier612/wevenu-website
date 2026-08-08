/**
 * Display helpers for vendor↔venue / vendor↔couple threads.
 * Prefer real names; fall back to short generic phrases when missing.
 */

export type VendorCounterpartyRole = "Venue" | "Couple";

export function vendorCounterpartyDisplayName(
  role: VendorCounterpartyRole | null | undefined,
  venueName: string | null | undefined,
  coupleName: string | null | undefined,
): string {
  if (role === "Couple") {
    return coupleName?.trim() || "the couple";
  }
  return venueName?.trim() || "the venue";
}

/** Who cannot see the active pairwise thread (the other role). */
export function vendorHiddenCounterpartyPhrase(
  role: VendorCounterpartyRole | null | undefined,
): string {
  return role === "Couple" ? "the venue" : "the couple";
}
