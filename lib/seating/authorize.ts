/**
 * Venue staff authorization for Seating.
 *
 * Viewing / day-of lookup / print: any venue staff role.
 * Edit + submit: owner / manager / coordinator AND active client delegation
 *   (delegation is enforced in SECURITY DEFINER RPCs).
 * Revoke delegation (venue side): owner / manager only.
 *
 * Venue access to an event never grants seating authority by itself.
 */

export type SeatingVenueRole = "owner" | "manager" | "coordinator" | "staff";

export const SEATING_VIEW_DENIED =
  "You don't have permission to view seating.";

export const SEATING_EDIT_DENIED =
  "You don't have permission to edit seating. Only an Owner, Manager, or Coordinator can assist when the client has delegated seating.";

export const SEATING_REVOKE_DENIED =
  "Only an Owner or Manager can revoke seating assistance.";

export function canViewSeating(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager" || role === "coordinator" || role === "staff";
}

/** Edit / submit while client-delegated — still requires active delegation at the RPC. */
export function canEditSeatingWhenDelegated(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager" || role === "coordinator";
}

export function canRevokeSeatingDelegation(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager";
}
