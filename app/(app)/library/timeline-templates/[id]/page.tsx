import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TimelineTemplateEditor } from "@/components/timeline-templates/timeline-template-editor";
import { getSpaces } from "@/lib/availability/service";
import { eventTypeLabel } from "@/lib/leads/constants";
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="space-y-1">
        <Link href="/library/timeline-templates" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Timeline Templates
        </Link>
        <h1 className="font-heading text-2xl font-medium text-heading">{template.name}</h1>
        <p className="text-sm text-muted-foreground">
          {template.eventType ? eventTypeLabel(template.eventType) : "Any event type"}
          {spaceName ? ` · ${spaceName}` : ""} · {items.length} item{items.length !== 1 ? "s" : ""}
        </p>
      </div>
      <TimelineTemplateEditor templateId={id} initialItems={items} />
    </div>
  );
}
