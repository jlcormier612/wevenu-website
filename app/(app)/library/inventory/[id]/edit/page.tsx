import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { ItemUpcomingReservations } from "@/components/inventory/item-upcoming-reservations";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getItemUpcomingReservations } from "@/lib/inventory/reservations-service";
import { getCategories, getItem } from "@/lib/inventory/service";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  return { title: item ? `${item.name} — Inventory` : "Inventory Item" };
}

export default async function EditInventoryItemPage({ params }: Props) {
  const { id } = await params;
  const [item, categories, venue, upcoming] = await Promise.all([
    getItem(id), getCategories(), getCurrentVenue(), getItemUpcomingReservations(id),
  ]);
  if (!item || !venue) notFound();

  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="inventory-edit">
      <CollectionBackLink href="/library/inventory" label="Inventory" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader title={item.name} description="Edit this inventory item." />
      </div>
      <Card className="htc-working-card htc-working-card-guidance gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Item details</CardTitle>
          <CardDescription>Changes apply to this catalog item. Existing reservations are unchanged.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <InventoryItemForm item={item} categories={categories} venueId={venue.id} />
        </CardContent>
      </Card>
      <ItemUpcomingReservations owned={upcoming.owned} rows={upcoming.rows} />
    </div>
  );
}
