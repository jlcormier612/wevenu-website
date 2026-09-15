import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventOrderTemplatePreviewView } from "@/components/event-order-templates/event-order-template-preview";
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

  return (
    <LibraryPreviewChrome
      caption="Reusable template preview — applying it to an event creates that event’s own structure."
      editHref={`/library/event-order-templates/${template.id}`}
      libraryHref="/library/event-order-templates"
      contentMaxWidthClassName="max-w-xl"
    >
      <div className="pb-10">
        <EventOrderTemplatePreviewView template={template} />
      </div>
    </LibraryPreviewChrome>
  );
}
