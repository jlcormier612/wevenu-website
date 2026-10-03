/**
 * Booking Documents relationship scope — mirrors get_venue_documents when
 * both p_event_id and p_client_id are set.
 *
 * Includes event-linked rows for this booking, plus client-only commercial/
 * upload rows (event_id null). Never includes another event's rows.
 */

export type BookingScopeRow = {
  eventId: string | null | undefined;
  clientId: string | null | undefined;
};

/** Pure predicate used by focused tests; SQL migration is the runtime source. */
export function matchesBookingRelationshipScope(
  row: BookingScopeRow,
  booking: { eventId: string; clientId: string },
): boolean {
  if (row.eventId === booking.eventId) return true;
  if (row.eventId == null && row.clientId === booking.clientId) return true;
  return false;
}

export function isBookingDocumentsScope(scope: {
  eventId?: string | null;
  clientId?: string | null;
  leadId?: string | null;
  vendorId?: string | null;
}): boolean {
  return Boolean(scope.eventId && scope.clientId && !scope.leadId && !scope.vendorId);
}
