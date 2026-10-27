import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link
        href="/library/timeline-templates"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Timeline Templates
      </Link>
      <TimelineTemplateEditorHeader
        template={template}
        spaces={spaces}
        spaceName={spaceName ?? null}
        itemCount={items.length}
        masterDescription={master?.description ?? null}
      />
      <TimelineTemplateEditor templateId={id} initialItems={items} />
    </div>
  );
}
