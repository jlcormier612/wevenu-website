import type { Metadata } from "next";
import Link from "next/link";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
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
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
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
      <LibraryHowItWorks>
        Maintain the reusable stock catalog here. Floor Plan Templates can place items marked for floor plans. Inventory Templates and the event Inventory tab pull from this catalog when building an event list — those are separate from this catalog page.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="Mark items for floor plans when they should appear in the floor-plan editor. Inventory Templates are reusable packing lists authored separately — Use/Send them from Inventory Templates (or apply on the event), then add catalog items on the event if needed."
        action={{ href: "/library/floor-plan-templates", label: "Open Floor Plan Templates" }}
        secondaryActions={[
          { href: "/library/inventory-templates", label: "Open Inventory Templates" },
        ]}
      >
        Used when placing furniture on floor plans and when adding stock to an event&apos;s inventory.
      </LibraryDependencyNote>
      <InventoryLibrarySection initialItems={items} />
      <StockSharingSetting initial={stockSharing} />
    </div>
  );
}
