/**
 * Venue Migration Center must not import individual guest-list rows.
 * Guests are client-owned; venues use operational aggregates (counts,
 * seating, floor plans, event orders) — not unrestricted guest PII.
 */

import type { MigrationEntityType } from "@/lib/migration/types";

export const VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE =
  "Guest lists belong to the client and cannot be imported through the venue Migration Center. Clients manage their guest list in their portal; venues use guest counts, seating, floor plans, and event orders for delivery.";

export function isVenueGuestListImportRemoved(
  entityType: MigrationEntityType | string,
): boolean {
  return entityType === "guest_list";
}
