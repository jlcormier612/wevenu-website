import { loadBookedMembershipSets } from "@/lib/booking-journey/booked-membership";

/**
 * Booked chip count only — kept off the Leads list critical path.
 * Streams in under Suspense after rows are ready.
 */
export async function LeadsBookedChipCount() {
  const sets = await loadBookedMembershipSets();
  return <>{sets.currentClientIds.size}</>;
}
