/**
 * Venue staff who may enable / edit / submit texting setup.
 * Matches Settings → Leads inquiry-form authority (owner | manager).
 */
export function canConfigureVenueTexting(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

export const TEXTING_SETUP_ROLE_DENIED =
  "Only a venue owner or manager can enable or change text messaging setup.";
