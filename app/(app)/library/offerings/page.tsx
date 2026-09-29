import type { Metadata } from "next";
import Link from "next/link";

import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
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
        description="Menus, bar, services, and rentals you provide — a catalog, not a template."
        actions={
          <Button variant="outline" render={<Link href="/library/inventory" />}>
            Physical Inventory
          </Button>
        }
      />
      <LibraryHowItWorks>
        These are reusable sellable items. Edit them here; Event Order Templates and Choices Templates select from this catalog when you build those templates.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        links={[
          { href: "/library/event-order-templates", label: "Event Order Templates →" },
          { href: "/library/choices-templates", label: "Choices Templates →" },
          { href: "/library/inventory", label: "Available Inventory →" },
        ]}
      >
        Used by Event Order Templates and Choices Templates. You can optionally link an offering to a physical inventory item.
      </LibraryDependencyNote>
      <OfferingsLibrarySection
        initialOfferings={offerings}
        categories={categories}
        inventoryItems={inventoryItems}
      />
    </div>
  );
}
