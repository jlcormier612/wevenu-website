import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventOrderClientPreview } from "@/components/event-order-templates/event-order-client-preview";
import { TemplateWorkflowChrome } from "@/components/event-order-templates/template-workflow-chrome";
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
      caption="Client Preview — the choices a client would see. Selections on this page are not saved or sent."
      editHref={`/library/event-order-templates/${template.id}`}
      libraryHref="/library/event-order-templates"
      libraryLabel="Event Order Templates"
      contentMaxWidthClassName="w-full max-w-3xl"
    >
      <div className="pb-10 space-y-4">
        <TemplateWorkflowChrome templateId={template.id} current="preview" />
        <EventOrderClientPreview template={template} />
      </div>
    </LibraryPreviewChrome>
  );
}
