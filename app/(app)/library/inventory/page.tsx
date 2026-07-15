import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { InventoryLibrarySection } from "@/components/inventory/inventory-library-section";
import { getItemsForLibrary } from "@/lib/inventory/service";

export const metadata: Metadata = { title: "Inventory Templates" };

export default async function InventoryLibraryPage() {
  const items = await getItemsForLibrary();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Templates"
        description="Reusable physical inventory — tables, chairs, decor, and anything else you set up for a booking."
        actions={
          <Button variant="outline" render={<Link href="/settings/import?type=inventory" />}>
            Import Inventory Templates
          </Button>
        }
      />
      <InventoryLibrarySection initialItems={items} />
    </div>
  );
}
