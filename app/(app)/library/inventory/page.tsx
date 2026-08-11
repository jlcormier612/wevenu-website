import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { InventoryLibrarySection } from "@/components/inventory/inventory-library-section";
import { ensureInventoryStartersForCurrentVenue } from "@/lib/inventory/provision";
import { getItemsForLibrary } from "@/lib/inventory/service";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryLibraryPage() {
  await ensureInventoryStartersForCurrentVenue();
  const items = await getItemsForLibrary();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Inventory"
        description="Keep a list of the items and amenities your venue provides, then use them to build event-specific inventory."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/library/inventory-templates" />}>
              Inventory Templates
            </Button>
            <Button variant="outline" render={<Link href="/settings/import?type=inventory" />}>
              Import Inventory
            </Button>
          </div>
        }
      />
      <InventoryLibrarySection initialItems={items} />
    </div>
  );
}
