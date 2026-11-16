import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuestionnaireAuthoringWorkspace } from "@/components/questionnaire-templates/questionnaire-authoring-workspace";
import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { getTemplate } from "@/lib/questionnaire-templates/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Edit · ${template.name}` : "Edit questionnaire" };
}

export default async function QuestionnaireTemplateEditPage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="space-y-4">
      <div className="px-4 pt-4">
        <SetupHubReturnLink href="/setup-hub/make-htc-yours/event-experiences" label="Back to Your event experiences" />
      </div>
      <QuestionnaireAuthoringWorkspace
        key={`${template.id}-${template.updatedAt}`}
        template={template}
      />
    </div>
  );
}
