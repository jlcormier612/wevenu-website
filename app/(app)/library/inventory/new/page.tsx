import type { Metadata } from "next";

import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent } from "@/components/ui/card";
import { getCategories } from "@/lib/inventory/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "New Inventory Item" };

export default async function NewInventoryItemPage() {
  const [categories, venue] = await Promise.all([getCategories(), getCurrentVenue()]);
  return (
    <div className="space-y-6">
      <PageHeader title="New Inventory Item" description="Add a reusable item to your inventory." />
      <Card>
        <CardContent className="pt-6">
          <InventoryItemForm categories={categories} venueId={venue?.id ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
