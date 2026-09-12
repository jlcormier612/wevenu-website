/**
 * Offerings starter provision — idempotent category + example items (no prices).
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import * as repo from "@/lib/offerings/repository";
import { OFFERING_STARTER_CATEGORIES } from "@/lib/offerings/starters";

export async function ensureOfferingStartersForCurrentVenue(): Promise<{
  ok: true; createdCategories: number; createdOfferings: number;
} | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const existingCategories = await repo.getCategories(supabase, venue.id);
  const existingOfferings = await repo.getOfferings(supabase, venue.id, { includeArchived: true });
  const categoryByName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c]));
  const offeringNames = new Set(existingOfferings.map((o) => o.name.toLowerCase()));

  let createdCategories = 0;
  let createdOfferings = 0;

  for (const cat of OFFERING_STARTER_CATEGORIES) {
    let categoryId = categoryByName.get(cat.name.toLowerCase())?.id ?? null;
    if (!categoryId) {
      categoryId = await repo.insertCategory(supabase, venue.id, cat.name);
      createdCategories++;
      categoryByName.set(cat.name.toLowerCase(), {
        id: categoryId, venueId: venue.id, name: cat.name, sortOrder: 0,
        createdAt: "", updatedAt: "",
      });
    }
    for (const item of cat.items) {
      if (offeringNames.has(item.name.toLowerCase())) continue;
      await repo.insertOffering(supabase, venue.id, {
        name: item.name,
        categoryId,
        description: item.description ?? "",
        unit: item.unit ?? "",
        defaultUnitPrice: "",
        inventoryItemId: null,
      });
      offeringNames.add(item.name.toLowerCase());
      createdOfferings++;
    }
  }

  return { ok: true, createdCategories, createdOfferings };
}
