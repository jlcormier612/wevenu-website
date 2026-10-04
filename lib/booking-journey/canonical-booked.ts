/**
 * Compatibility wrapper. Authoritative Booked membership lives in
 * booked-membership.ts. This is not an events.booked_at definition.
 */
import { getAuthoritativeBookedClientIds } from "@/lib/booking-journey/booked-membership";

/** Current ∪ past Booked client ids for Clients list filters. */
export async function getCanonicallyBookedClientIds(): Promise<Set<string>> {
  return getAuthoritativeBookedClientIds();
}
