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
        description="Menus, bar, services, and rentals you provide — create and edit them here."
        actions={
          <Button variant="outline" render={<Link href="/library/inventory" />}>
            Available Inventory
          </Button>
        }
      />
      <LibraryHowItWorks>
        Create sellable offerings here. Event Order Templates select from this catalog when you build fixed lines and choice options.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="After you add or update offerings here, open an Event Order Template and select which offerings to include as fixed lines or choice options. You can optionally link an offering to a physical inventory item."
        action={{ href: "/library/event-order-templates", label: "Open Event Order Templates" }}
        secondaryActions={[
          { href: "/library/inventory", label: "Manage Available Inventory" },
        ]}
      >
        Used by Event Order Templates.
      </LibraryDependencyNote>
      <OfferingsLibrarySection
        initialOfferings={offerings}
        categories={categories}
        inventoryItems={inventoryItems}
      />
    </div>
  );
}
