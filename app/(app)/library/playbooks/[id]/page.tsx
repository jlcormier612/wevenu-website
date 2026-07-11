import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DuplicatePlaybookButton } from "@/components/playbooks/duplicate-playbook-button";
import { PlaybookBuilder } from "@/components/playbooks/playbook-builder";
import { getVenueDocuments } from "@/lib/documents/service";
import { playbookKindLabel, PLAYBOOK_KINDS } from "@/lib/playbooks/constants";
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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/library/playbooks" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Planning Templates
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-medium text-heading">{template.name}</h1>
            <span className="text-xs font-medium text-muted-foreground">
              {PLAYBOOK_KINDS.find((k) => k.value === template.kind)?.emoji} {playbookKindLabel(template.kind)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {template.eventType ? `${template.eventType.replace(/_/g, " ")} template` : "All event types"} · {tasks.length} task{tasks.length !== 1 ? "s" : ""} across {milestones.length} milestone{milestones.length !== 1 ? "s" : ""}
          </p>
        </div>
        <DuplicatePlaybookButton templateId={id} templateName={template.name} />
      </div>
      <PlaybookBuilder
        kind={template.kind} templateId={id} initialMilestones={milestones} initialTasks={tasks}
        attachmentsByTask={attachmentsByTask} venueDocuments={venueDocuments}
      />
    </div>
  );
}
