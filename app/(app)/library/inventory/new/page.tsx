import type { Metadata } from "next";

import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategories } from "@/lib/inventory/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "New Inventory Item" };

export default async function NewInventoryItemPage() {
  const [categories, venue] = await Promise.all([getCategories(), getCurrentVenue()]);
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="inventory-new">
      <CollectionBackLink href="/library/inventory" label="Inventory" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader title="New Inventory Item" description="Add a reusable item to your inventory." />
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Item details</CardTitle>
          <CardDescription>You can edit quantity, category, and notes any time after you save.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <InventoryItemForm categories={categories} venueId={venue?.id ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
