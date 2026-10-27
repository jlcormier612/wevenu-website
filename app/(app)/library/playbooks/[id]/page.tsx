import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PlaybookBuilder } from "@/components/playbooks/playbook-builder";
import { PlaybookTemplateEditorHeader } from "@/components/playbooks/playbook-template-editor-header";
import { getVenueDocuments } from "@/lib/documents/service";
import { getMilestones, getPlaybookTaskAttachmentsForTemplate, getTemplate, getTemplateTasks } from "@/lib/playbooks/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `${template.name} — Planning Templates` : "Planning Template Editor" };
}

export default async function PlaybookEditorPage({ params }: Props) {
  const { id } = await params;
  const [template, tasks, milestones, attachmentsByTask, venueDocuments] = await Promise.all([
    getTemplate(id), getTemplateTasks(id), getMilestones(id), getPlaybookTaskAttachmentsForTemplate(id), getVenueDocuments(),
  ]);
  if (!template) notFound();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link href="/library/playbooks" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Planning Templates
      </Link>
      <PlaybookTemplateEditorHeader
        template={template}
        taskCount={tasks.length}
        milestoneCount={milestones.length}
      />
      <PlaybookBuilder
        kind={template.kind} templateId={id} initialMilestones={milestones} initialTasks={tasks}
        attachmentsByTask={attachmentsByTask} venueDocuments={venueDocuments}
      />
    </div>
  );
}
