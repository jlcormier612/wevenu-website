import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { InventoryLibrarySection } from "@/components/inventory/inventory-library-section";
import { getItemsForLibrary } from "@/lib/inventory/service";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryLibraryPage() {
  const items = await getItemsForLibrary();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Reusable physical inventory — tables, chairs, decor, and anything else you set up for a booking."
      />
      <InventoryLibrarySection initialItems={items} />
    </div>
  );
}
