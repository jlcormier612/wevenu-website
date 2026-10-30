/**
 * Seed Event Order lines from the booking-spine Selected Package (commercial_selection).
 *
 * Package inclusions are frozen on the selection (direct Select package) or on the
 * chosen proposal options (proposal-approved selections, whose included_items list
 * the chosen packages themselves). Inclusions explicitly linked to an Offering seed
 * as included Offering lines; the rest seed as included custom lines. Both carry an
 * auditable notes stamp. Never matches catalog items by name.
 */

export type PackageInclusionSeedItem = {
  description: string;
  quantity: number;
  unit: string | null;
  offeringId?: string | null;
  perGuest?: boolean;
};

export const PACKAGE_SELECTION_NOTES_PREFIX = "package-selection:";

export function packageInclusionDedupeKey(description: string): string {
  return description.trim().toLowerCase();
}

export function packageSelectionNotes(selectionId: string, packageName: string): string {
  return `${PACKAGE_SELECTION_NOTES_PREFIX}${selectionId}|${packageName.trim()}`;
}

/** Package name from a seed stamp, or null when the notes are not a seed stamp. */
export function packageNameFromSelectionNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  if (!trimmed?.startsWith(PACKAGE_SELECTION_NOTES_PREFIX)) return null;
  const bar = trimmed.indexOf("|");
  return bar >= 0 ? trimmed.slice(bar + 1).trim() || null : null;
}

type SelectionForSeed = {
  proposalId: string | null;
  includedItems: PackageInclusionSeedItem[];
};

type ChosenProposalOption = {
  includedItems: PackageInclusionSeedItem[];
};

/**
 * Inclusions to seed for a selection. Proposal-approved selections use the frozen
 * contents of the options the couple chose; when none are recorded, falls back to
 * the selection's own items.
 */
export function resolveSelectionInclusions(
  selection: SelectionForSeed,
  chosenOptions: ChosenProposalOption[] | null,
): PackageInclusionSeedItem[] {
  if (selection.proposalId && chosenOptions) {
    const contents = chosenOptions.flatMap((o) => o.includedItems ?? []);
    if (contents.length > 0) return contents;
  }
  return selection.includedItems;
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
      ...(item.offeringId ? { offeringId: item.offeringId } : {}),
      ...(item.perGuest ? { perGuest: true } : {}),
    });
  }
  return out;
}

/** Event Order quantity for a seeded inclusion: per-guest counts scale with the guest count. */
export function seededInclusionQuantity(
  item: Pick<PackageInclusionSeedItem, "quantity" | "perGuest">,
  guestCount: number | null,
): number {
  if (item.perGuest && guestCount && guestCount > 0) return Number((item.quantity * guestCount).toFixed(2));
  return item.quantity;
}
