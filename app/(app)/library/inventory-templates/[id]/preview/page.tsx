import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LibraryPreviewChrome } from "@/components/library/library-preview-chrome";
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
    <LibraryPreviewChrome
      caption="Inventory template preview — allocation structure for your team. Not a client-facing page."
      editHref={`/library/inventory-templates/${template.id}`}
      libraryHref="/library/inventory-templates"
      contentMaxWidthClassName="max-w-xl"
    >
      <div className="space-y-4 pb-10">
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
    </LibraryPreviewChrome>
  );
}
