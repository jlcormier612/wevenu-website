import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeletePipelineTemplateButton } from "@/components/settings/delete-pipeline-template-button";
import { PipelineTemplateForm } from "@/components/settings/pipeline-template-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplate } from "@/lib/pipeline-templates/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTemplate(id);
  return { title: t ? `Edit · ${t.name}` : "Edit Pipeline Template" };
}

export default async function EditPipelineTemplatePage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit · ${template.name}`}
        description="Update the stages. Nothing here affects your current Leads pipeline yet."
        actions={<DeletePipelineTemplateButton templateId={template.id} templateName={template.name} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Pipeline editor</CardTitle>
          <CardDescription>Drag stages to reorder them. Each stage maps to a fixed canonical stage used for reporting.</CardDescription>
        </CardHeader>
        <CardContent>
          <PipelineTemplateForm template={template} />
        </CardContent>
      </Card>
    </div>
  );
}
