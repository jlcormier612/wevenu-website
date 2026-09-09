import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getTemplate } from "@/lib/event-order-templates/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Preview — ${template.name}` : "Preview event order template" };
}

export default async function EventOrderTemplatePreviewPage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  const sections = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 max-w-xl mx-auto">
        <p className="text-sm text-muted-foreground">Delivery structure preview (sections only — not a client invoice)</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" render={<Link href={`/library/event-order-templates/${template.id}`} />}>
            Back to edit
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/library/event-order-templates" />}>
            Library
          </Button>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 pb-10 space-y-4">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-medium text-heading">{template.name}</h1>
          <p className="text-xs text-muted-foreground">Event Order Template — structure applied to events</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-6 space-y-4">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections yet.</p>
          ) : (
            sections.map((s) => (
              <div key={s.id} className="space-y-1">
                <p className="text-sm font-medium text-heading">{s.name}</p>
                {s.guidance ? (
                  <p className="text-xs text-muted-foreground">{s.guidance}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No guidance — fill with Offerings on the Event Order.</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
