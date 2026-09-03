import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getTemplate } from "@/lib/event-inventory/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Preview — ${template.name}` : "Preview inventory template" };
}

export default async function InventoryTemplatePreviewPage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 max-w-xl mx-auto">
        <p className="text-sm text-muted-foreground">Preview as your clients will see it</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" render={<Link href={`/library/inventory-templates/${template.id}`} />}>
            Back to edit
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/library/inventory-templates" />}>
            Library
          </Button>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 pb-10 space-y-4">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-medium text-heading">{template.name}</h1>
          <p className="text-xs text-muted-foreground">Inventory Template</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-6">
          {template.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <ul className="space-y-1">
              {template.items.map((item) => (
                <li key={item.id} className="text-sm text-foreground">
                  · {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
