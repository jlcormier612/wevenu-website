import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InventoryTemplateDetail } from "@/components/event-inventory/inventory-template-detail";
import { getTemplate } from "@/lib/event-inventory/service";
import { getItemsForLibrary } from "@/lib/inventory/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template?.name ?? "Inventory Template" };
}

export default async function InventoryTemplateDetailPage({ params }: Props) {
  const { id } = await params;
  const [template, catalogItems] = await Promise.all([getTemplate(id), getItemsForLibrary()]);
  if (!template) notFound();
  return <InventoryTemplateDetail template={template} catalogItems={catalogItems} />;
}
