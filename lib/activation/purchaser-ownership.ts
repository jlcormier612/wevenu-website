/**
 * Purchaser ≠ Owner — ownership choice must be explicit.
 * Missing/invalid values fail closed (never default to Owner).
 */

export const PURCHASER_OWNERSHIP_REQUIRED_ERROR =
  "purchaser_ownership_choice_required";

export const PURCHASER_OWNERSHIP_REQUIRED_MESSAGE =
  "Please say whether you are an owner of this venue, or setting it up on behalf of the venue.";

/**
 * Accept only an explicit boolean. Missing, null, or non-boolean → reject.
 */
export function parseExplicitPurchaserIsOwner(
  value: unknown,
): { ok: true; purchaserIsOwner: boolean } | { ok: false; error: string } {
  if (typeof value !== "boolean") {
    return { ok: false, error: PURCHASER_OWNERSHIP_REQUIRED_ERROR };
  }
  return { ok: true, purchaserIsOwner: value };
}
