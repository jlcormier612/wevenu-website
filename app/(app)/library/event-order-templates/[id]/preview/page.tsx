import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LibraryPreviewChrome } from "@/components/library/library-preview-chrome";
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
    <LibraryPreviewChrome
      caption="Delivery structure preview (sections only — not a client invoice or live package commitment)."
      editHref={`/library/event-order-templates/${template.id}`}
      libraryHref="/library/event-order-templates"
      contentMaxWidthClassName="max-w-xl"
    >
      <div className="space-y-4 pb-10">
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
    </LibraryPreviewChrome>
  );
}
