import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
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
    <div
      className="htc-hospitality-page space-y-5 sm:space-y-6"
      data-htc-phase12="planning-template-edit"
    >
      <SetupHubReturnLink href="/setup-hub/make-htc-yours/event-experiences" label="Back to Your event experiences" />
      <CollectionBackLink href="/library/playbooks" label="Planning Templates" />
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
