/**
 * Shared commercial category identity between Offerings catalog and EO Templates.
 *
 * Built-in categories are identified by SuggestedCategoryKey (via name/alias match).
 * Venue-created categories are venue-scoped offering_categories rows (UUID).
 * EO Template sections remain template-local; creating/selecting a section ensures
 * a matching offering_categories row so the Offerings editor can use the same label
 * without free-text-only linking of offerings.
 */
import {
  matchSuggestedCategory,
  normalizeCategoryLabel,
  SUGGESTED_CATEGORIES,
} from "@/lib/event-order-templates/guided-setup";
import * as repo from "@/lib/offerings/repository";
import type { OfferingCategory } from "@/lib/offerings/types";

type DbClient = Parameters<typeof repo.getCategories>[0];

export type EnsureOfferingCategoryResult = {
  id: string;
  name: string;
  created: boolean;
};

/** Prefer an existing category in the same suggested bucket or case-insensitive name. */
export function findMatchingOfferingCategory(
  categories: OfferingCategory[],
  desiredName: string,
): OfferingCategory | null {
  const wanted = normalizeCategoryLabel(desiredName);
  if (!wanted) return null;

  const exact = categories.find((c) => normalizeCategoryLabel(c.name) === wanted);
  if (exact) return exact;

  const suggested = matchSuggestedCategory(desiredName);
  if (!suggested) return null;
  return (
    categories.find((c) => matchSuggestedCategory(c.name)?.key === suggested.key) ?? null
  );
}

/**
 * Resolve or create a venue offering_categories row for a commercial category label.
 * Built-ins reuse the suggested canonical name when creating; aliases map to one row.
 */
export async function findOrCreateOfferingCategory(
  client: DbClient,
  venueId: string,
  desiredName: string,
): Promise<EnsureOfferingCategoryResult> {
  const trimmed = desiredName.trim();
  if (!trimmed) throw new Error("Category name is required.");

  const existing = await repo.getCategories(client, venueId);
  const match = findMatchingOfferingCategory(existing, trimmed);
  if (match) return { id: match.id, name: match.name, created: false };

  const suggested = matchSuggestedCategory(trimmed);
  const createName = suggested?.name ?? trimmed;
  // Race-safe: unique (venue_id, name) — if insert conflicts, re-read.
  try {
    const id = await repo.insertCategory(client, venueId, createName);
    return { id, name: createName, created: true };
  } catch (err) {
    const again = await repo.getCategories(client, venueId);
    const retry = findMatchingOfferingCategory(again, createName)
      ?? findMatchingOfferingCategory(again, trimmed);
    if (retry) return { id: retry.id, name: retry.name, created: false };
    throw err;
  }
}

/** Built-in suggested categories that must appear in the Offerings editor. */
export function builtInOfferingCategoryNames(): string[] {
  return SUGGESTED_CATEGORIES.filter((c) => c.key !== "custom").map((c) => c.name);
}

/**
 * Ensure built-in categories exist, plus any labels from the venue's EO template sections.
 * Does not delete categories or offerings. Idempotent.
 */
export async function ensureVenueCommercialCategories(
  client: DbClient,
  venueId: string,
  extraNames: string[] = [],
): Promise<{ created: number; ensured: string[] }> {
  const names = [
    ...builtInOfferingCategoryNames(),
    ...extraNames.map((n) => n.trim()).filter(Boolean),
  ];
  const ensured: string[] = [];
  let created = 0;
  for (const name of names) {
    const result = await findOrCreateOfferingCategory(client, venueId, name);
    ensured.push(result.name);
    if (result.created) created += 1;
  }
  return { created, ensured: [...new Set(ensured)] };
}
