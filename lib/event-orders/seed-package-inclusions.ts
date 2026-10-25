/**
 * Seed Event Order lines from the booking-spine Selected Package (commercial_selection).
 *
 * Package inclusions are frozen text on commercial_selections — not Offering FKs.
 * Seeding creates included custom EO lines (provenance custom) with an auditable
 * notes stamp. Never invents Offering links or matches by catalog name.
 */

export type PackageInclusionSeedItem = {
  description: string;
  quantity: number;
  unit: string | null;
};

export const PACKAGE_SELECTION_NOTES_PREFIX = "package-selection:";

export function packageInclusionDedupeKey(description: string): string {
  return description.trim().toLowerCase();
}

export function packageSelectionNotes(selectionId: string, packageName: string): string {
  return `${PACKAGE_SELECTION_NOTES_PREFIX}${selectionId}|${packageName.trim()}`;
}

/**
 * Inclusions not already represented on the Event Order (description match,
 * case-insensitive, any section). Also dedupes within the inclusion list itself.
 */
export function filterPackageInclusionsToSeed(
  inclusions: PackageInclusionSeedItem[],
  existingLineDescriptions: string[],
): PackageInclusionSeedItem[] {
  const existing = new Set(
    existingLineDescriptions.map(packageInclusionDedupeKey).filter(Boolean),
  );
  const out: PackageInclusionSeedItem[] = [];
  const seen = new Set<string>();
  for (const item of inclusions) {
    const key = packageInclusionDedupeKey(item.description);
    if (!key || existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      description: item.description.trim(),
      quantity: item.quantity > 0 ? item.quantity : 1,
      unit: item.unit,
    });
  }
  return out;
}
