import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteTemplateButton } from "@/components/communication/delete-template-button";
import { TemplateForm } from "@/components/communication/template-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplate } from "@/lib/message-templates/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTemplate(id);
  return { title: t ? `Edit · ${t.name}` : "Edit Template" };
}

export default async function EditMessageTemplatePage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit · ${template.name}`}
        description="Update the template content and merge fields."
        actions={<DeleteTemplateButton templateId={template.id} templateName={template.name} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Template editor</CardTitle>
          <CardDescription>Changes take effect the next time this template is used.</CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateForm template={template} />
        </CardContent>
      </Card>
    </div>
  );
}
