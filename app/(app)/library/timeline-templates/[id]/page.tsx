import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { TimelineTemplateEditor } from "@/components/timeline-templates/timeline-template-editor";
import { TimelineTemplateEditorHeader } from "@/components/timeline-templates/timeline-template-editor-header";
import { getSpaces } from "@/lib/availability/service";
import { getTimelineStarterMaster } from "@/lib/timeline-templates/starters";
import { getItems, getTemplate } from "@/lib/timeline-templates/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `${template.name} — Timeline Templates` : "Timeline Template Editor" };
}

export default async function TimelineTemplateEditorPage({ params }: Props) {
  const { id } = await params;
  const [template, items, spaces] = await Promise.all([getTemplate(id), getItems(id), getSpaces()]);
  if (!template) notFound();

  const spaceName = template.spaceId ? spaces.find((s) => s.id === template.spaceId)?.name : null;
  const master = template.sourceMasterKey
    ? getTimelineStarterMaster(template.sourceMasterKey)
    : undefined;

  return (
    <div
      className="htc-hospitality-page mx-auto max-w-3xl space-y-5 sm:space-y-6"
      data-htc-phase12="timeline-template-edit"
    >
      <CollectionBackLink href="/library/timeline-templates" label="Timeline Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <TimelineTemplateEditorHeader
          template={template}
          spaces={spaces}
          spaceName={spaceName ?? null}
          itemCount={items.length}
          masterDescription={master?.description ?? null}
        />
      </div>
      <TimelineTemplateEditor templateId={id} initialItems={items} />
    </div>
  );
}
