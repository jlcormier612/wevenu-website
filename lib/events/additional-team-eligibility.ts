/**
 * Pure eligibility rules for compact Additional Team Members selection.
 * Additional staff persist as free-text event_team.full_name rows; new adds
 * come only from the venue's internal staff list passed by the page.
 */

export type AdditionalStaffOption = { id: string; name: string };

export function staffNamesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Eligible internal members for the additional-staff selector:
 * exclude event owner (by id and by name) and anyone already on the roster
 * (case-insensitive name match, including legacy free-text rows).
 */
export function filterEligibleAdditionalStaff(
  staffOptions: AdditionalStaffOption[],
  assignedNames: string[],
  ownerStaffId: string | null | undefined,
): AdditionalStaffOption[] {
  const ownerName = ownerStaffId
    ? staffOptions.find((s) => s.id === ownerStaffId)?.name ?? null
    : null;

  return staffOptions.filter((s) => {
    if (ownerStaffId && s.id === ownerStaffId) return false;
    if (ownerName && staffNamesMatch(s.name, ownerName)) return false;
    if (assignedNames.some((n) => staffNamesMatch(n, s.name))) return false;
    return true;
  });
}
