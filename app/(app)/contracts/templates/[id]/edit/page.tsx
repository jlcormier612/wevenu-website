import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContractStarterEditGate } from "@/components/contracts/contract-starter-edit-gate";
import { TemplateForm } from "@/components/contracts/template-form";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplate } from "@/lib/contracts/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getTemplate(id);
  return { title: t ? `Edit · ${t.name}` : "Edit Template" };
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  if (template.sourceMasterKey) {
    return (
      <div className="space-y-6">
        <CollectionBackLink href="/library/contracts" label="Contract Templates" />
        <PageHeader
          title={template.name}
          description="Hello to Cheers starter — customize to create your venue’s editable copy."
        />
        <ContractStarterEditGate templateId={template.id} templateName={template.name} />
      </div>
    );
  }

  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="contract-template-edit">
      <CollectionBackLink href="/library/contracts" label="Contract Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader title={`Edit · ${template.name}`} description="Update the template content and merge fields." />
      </div>
      <Card className="htc-working-card htc-working-card-guidance gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Template editor</CardTitle>
          <CardDescription>Changes take effect for new contracts. Existing contracts are unaffected.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <TemplateForm template={template} />
        </CardContent>
      </Card>
    </div>
  );
}
