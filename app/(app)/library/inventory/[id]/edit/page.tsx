import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { ItemUpcomingReservations } from "@/components/inventory/item-upcoming-reservations";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="space-y-6">
      <PageHeader title={item.name} description="Edit this inventory item." />
      <Card>
        <CardContent className="pt-6">
          <InventoryItemForm item={item} categories={categories} venueId={venue.id} />
        </CardContent>
      </Card>
      <ItemUpcomingReservations owned={upcoming.owned} rows={upcoming.rows} />
    </div>
  );
}
