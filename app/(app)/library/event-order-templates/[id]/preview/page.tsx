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
  const unsectioned = template.lines.filter((l) => !l.sectionId).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 max-w-xl mx-auto">
        <p className="text-sm text-muted-foreground">Preview as your clients will see it</p>
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
          <p className="text-xs text-muted-foreground">Event Order Template</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-6 space-y-4">
          {sections.length === 0 && unsectioned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sections or lines yet.</p>
          ) : (
            <>
              {sections.map((s) => {
                const lines = template.lines.filter((l) => l.sectionId === s.id).sort((a, b) => a.sortOrder - b.sortOrder);
                return (
                  <div key={s.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-heading">{s.name}</p>
                    <ul className="space-y-1">
                      {lines.map((l) => (
                        <li key={l.id} className="text-sm text-foreground">· {l.description}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {unsectioned.length > 0 && (
                <ul className="space-y-1">
                  {unsectioned.map((l) => (
                    <li key={l.id} className="text-sm text-foreground">· {l.description}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
