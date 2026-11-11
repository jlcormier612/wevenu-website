import type { Metadata } from "next";
import Link from "next/link";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { InventoryLibrarySection } from "@/components/inventory/inventory-library-section";
import { StockSharingSetting } from "@/components/inventory/stock-sharing-setting";
import { ensureInventoryStartersForCurrentVenue } from "@/lib/inventory/provision";
import { getStockSharingForCurrentVenue } from "@/lib/inventory/reservations-service";
import { getItemsForLibrary } from "@/lib/inventory/service";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryLibraryPage() {
  await ensureInventoryStartersForCurrentVenue();
  const [items, stockSharing] = await Promise.all([getItemsForLibrary(), getStockSharingForCurrentVenue()]);
  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Available Inventory"
          description="Physical stock catalog your venue owns — create and edit items here. Editing the catalog does not share with clients, create event inventory, or create an Event Order."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button render={<Link href="/library/inventory/new" />}>
                + New Inventory Item
              </Button>
              <Button variant="outline" render={<Link href="/settings/import?type=inventory" />}>
                Import Inventory
              </Button>
            </div>
          }
        />
      </div>
      <LibraryDependencyNote
        tone="calm"
        detail="Maintain the reusable stock catalog here. Floor Plan Templates can place items marked for floor plans. Inventory Templates and the event Inventory tab pull from this catalog when building an event list — those are separate from this catalog page. Set when two events can share the same stock in the card just below."
        action={{ href: "/library/floor-plan-templates", label: "Open Floor Plan Templates" }}
        secondaryActions={[
          { href: "/library/inventory-templates", label: "Open Inventory Templates" },
        ]}
      >
        How Available Inventory works
      </LibraryDependencyNote>
      <div id="stock-sharing">
        <StockSharingSetting initial={stockSharing} />
      </div>
      <InventoryLibrarySection initialItems={items} />
    </div>
  );
}
