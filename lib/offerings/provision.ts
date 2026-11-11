/**
 * Offerings starter provision — idempotent category + example items (no prices).
 * Also ensures EO Template built-in / section labels exist as offering_categories.
 */
import { createClient } from "@/integrations/supabase/server";
import {
  ensureVenueCommercialCategories,
  findMatchingOfferingCategory,
  findOrCreateOfferingCategory,
} from "@/lib/offerings/category-identity";
import * as repo from "@/lib/offerings/repository";
import { OFFERING_STARTER_CATEGORIES } from "@/lib/offerings/starters";
import { getCurrentVenue } from "@/lib/venue/service";

export async function ensureOfferingStartersForCurrentVenue(): Promise<{
  ok: true; createdCategories: number; createdOfferings: number;
} | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  // Pull EO template section names so custom package categories appear in Offerings.
  const { data: sectionRows } = await supabase
    .from("event_order_template_sections")
    .select("name")
    .eq("venue_id", venue.id);
  const sectionNames = [...new Set(
    ((sectionRows as { name: string }[] | null) ?? []).map((s) => s.name).filter(Boolean),
  )];

  const commercial = await ensureVenueCommercialCategories(supabase, venue.id, sectionNames);

  const existingCategories = await repo.getCategories(supabase, venue.id);
  const existingOfferings = await repo.getOfferings(supabase, venue.id, { includeArchived: true });
  const offeringNames = new Set(existingOfferings.map((o) => o.name.toLowerCase()));

  let createdCategories = commercial.created;
  let createdOfferings = 0;

  for (const cat of OFFERING_STARTER_CATEGORIES) {
    const ensured = await findOrCreateOfferingCategory(supabase, venue.id, cat.name);
    if (ensured.created) createdCategories += 1;
    const categoryId = ensured.id;
    // Refresh local map if findOrCreate created after our snapshot
    void findMatchingOfferingCategory(existingCategories, cat.name);

    for (const item of cat.items) {
      if (offeringNames.has(item.name.toLowerCase())) continue;
      await repo.insertOffering(supabase, venue.id, {
        name: item.name,
        categoryId,
        parentOfferingIds: [],
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
