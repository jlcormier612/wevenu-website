import { timingSafeEqual } from "crypto";

/**
 * CRM-assisted Checkout (Send Subscription Link) is server-to-server only.
 *
 * Workspace already authenticates the human operator (`edit_relationships`)
 * and loads the Relationship from the CRM store. Marketing then requires the
 * shared PRODUCT_SYNC_API_KEY Bearer — the same secret used for enrollment /
 * product-access bridges — before accepting an existing Stripe Customer ID
 * or Path-2 legal/name exemptions.
 *
 * Possession of a relationship id, Stripe Customer id, or email alone is never
 * enough. The browser never receives this key.
 */
export function authorizeCrmAssistedCheckout(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;

  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
