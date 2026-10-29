import type { Metadata } from "next";

import { OfferingsPageClient } from "@/components/offerings/offerings-page-client";
import { getItems } from "@/lib/inventory/service";
import { ensureOfferingStartersForCurrentVenue } from "@/lib/offerings/provision";
import { listOfferingCategories, listOfferings } from "@/lib/offerings/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Offerings" };

export default async function OfferingsLibraryPage() {
  await ensureOfferingStartersForCurrentVenue();
  const venue = await getCurrentVenue();
  const [offerings, categories, inventoryItems] = await Promise.all([
    listOfferings(true),
    listOfferingCategories(),
    getItems(),
  ]);

  return (
    <OfferingsPageClient
      venueId={venue?.id ?? ""}
      initialOfferings={offerings}
      categories={categories}
      inventoryItems={inventoryItems}
    />
  );
}
