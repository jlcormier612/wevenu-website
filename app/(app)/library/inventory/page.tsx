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
        title="Available Inventory"
        description="Physical stock your venue owns — a catalog, not a template."
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
      <p className="rounded-sm border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        These are reusable inventory items. Inventory Templates pull from this catalog; floor plans can place items marked for floor plans.
        {" "}
        <Link href="/library/inventory-templates" className="font-medium text-heading hover:underline">
          Manage inventory templates →
        </Link>
      </p>
      <InventoryLibrarySection initialItems={items} />
    </div>
  );
}
