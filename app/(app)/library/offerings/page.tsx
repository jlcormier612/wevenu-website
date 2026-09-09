import type { Metadata } from "next";
import Link from "next/link";

import { OfferingsLibrarySection } from "@/components/offerings/offerings-library-section";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getItems } from "@/lib/inventory/service";
import { ensureOfferingStartersForCurrentVenue } from "@/lib/offerings/provision";
import { listOfferingCategories, listOfferings } from "@/lib/offerings/service";

export const metadata: Metadata = { title: "Offerings" };

export default async function OfferingsLibraryPage() {
  await ensureOfferingStartersForCurrentVenue();
  const [offerings, categories, inventoryItems] = await Promise.all([
    listOfferings(true),
    listOfferingCategories(),
    getItems(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offerings"
        description="Menus, bar, services, and rentals you provide."
        actions={
          <Button variant="outline" render={<Link href="/library/inventory" />}>
            Physical Inventory
          </Button>
        }
      />
      <OfferingsLibrarySection
        initialOfferings={offerings}
        categories={categories}
        inventoryItems={inventoryItems}
      />
    </div>
  );
}
