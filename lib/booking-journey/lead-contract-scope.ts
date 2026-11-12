/**
 * Pure helpers for Lead Booking Journey contract scoping.
 * Mirrors production selection in load.ts / bestContract — used for
 * parity tests against historical venue-wide + filter semantics.
 */

export type JourneyContractRow = {
  id: string;
  status: string;
  clientId: string | null;
  eventId: string | null;
  executionOrigin?: string | null;
};

/** What Lead journey used after venue-wide getContracts(): filter to client. */
export function leadJourneyContractsFromVenueWide(
  allVenueContracts: JourneyContractRow[],
  clientId: string | null,
): JourneyContractRow[] {
  if (!clientId) return [];
  return allVenueContracts.filter((c) => c.clientId === clientId);
}

/**
 * Optimized scope before the same client filter:
 * - no client → empty (never pull venue-wide)
 * - client + event → client_id OR event_id rows
 * - client only → client_id rows
 * Then journey pick still filters to clientId (same as bestContract).
 */
export function leadJourneyContractsScoped(
  allVenueContracts: JourneyContractRow[],
  clientId: string | null,
  eventId: string | null,
): JourneyContractRow[] {
  if (!clientId) return [];
  const scoped = eventId
    ? allVenueContracts.filter((c) => c.clientId === clientId || c.eventId === eventId)
    : allVenueContracts.filter((c) => c.clientId === clientId);
  return scoped.filter((c) => c.clientId === clientId);
}

export function contractIdSet(rows: JourneyContractRow[]): string {
  return rows
    .map((r) => r.id)
    .sort()
    .join(",");
}
