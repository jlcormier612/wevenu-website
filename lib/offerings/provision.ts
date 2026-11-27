/**
 * Offerings starter provision — idempotent category + example items (no prices).
 * Also ensures EO Template built-in / section labels exist as offering_categories.
 *
 * Shared seed is used by venue_starter_provisioning STEPS (admin client) and by
 * the staff-session Templates/Offerings ensure path.
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

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type OfferingSeedResult = {
  ok: true;
  createdCategories: number;
  createdOfferings: number;
} | {
  ok: false;
  message: string;
};

/**
 * Idempotent offerings starter seed for a venue.
 * Safe for admin provisioning and staff ensure. Concurrent unique races (23505)
 * are treated as already present. Does not delete or overwrite customizations.
 */
export async function seedOfferingStarters(
  venueId: string,
  supabase: DbClient,
): Promise<OfferingSeedResult> {
  try {
    const { data: sectionRows } = await supabase
      .from("event_order_template_sections")
      .select("name")
      .eq("venue_id", venueId);
    const sectionNames = [...new Set(
      ((sectionRows as { name: string }[] | null) ?? [])
        .map((s) => s.name)
        .filter(Boolean),
    )];

    const commercial = await ensureVenueCommercialCategories(supabase, venueId, sectionNames);

    const existingCategories = await repo.getCategories(supabase, venueId);
    const existingOfferings = await repo.getOfferings(supabase, venueId, { includeArchived: true });
    const offeringNames = new Set(existingOfferings.map((o) => o.name.toLowerCase()));

    let createdCategories = commercial.created;
    let createdOfferings = 0;

    for (const cat of OFFERING_STARTER_CATEGORIES) {
      const ensured = await findOrCreateOfferingCategory(supabase, venueId, cat.name);
      if (ensured.created) createdCategories += 1;
      const categoryId = ensured.id;
      void findMatchingOfferingCategory(existingCategories, cat.name);

      for (const item of cat.items) {
        if (offeringNames.has(item.name.toLowerCase())) continue;
        try {
          await repo.insertOffering(supabase, venueId, {
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
        } catch (err) {
          const code =
            err && typeof err === "object" && "code" in err
              ? String((err as { code?: unknown }).code ?? "")
              : "";
          if (code === "23505") {
            offeringNames.add(item.name.toLowerCase());
            continue;
          }
          throw err;
        }
      }
    }

    return { ok: true, createdCategories, createdOfferings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        event: "offering_starter_ensure_failed",
        venueId,
        message,
      }),
    );
    return { ok: false, message };
  }
}

export async function ensureOfferingStartersForCurrentVenue(): Promise<OfferingSeedResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  return seedOfferingStarters(venue.id, supabase);
}
