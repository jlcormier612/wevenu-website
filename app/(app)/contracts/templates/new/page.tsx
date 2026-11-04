import type { Metadata } from "next";

import { TemplateForm } from "@/components/contracts/template-form";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TEMPLATE_CONTENT, DEFAULT_TEMPLATE_DESCRIPTION, DEFAULT_TEMPLATE_NAME } from "@/lib/contracts/constants";
import type { ContractTemplate } from "@/lib/contracts/types";

export const metadata: Metadata = { title: "New Template" };

export default function NewTemplatePage() {
  const starter: Partial<ContractTemplate> = {
    name: DEFAULT_TEMPLATE_NAME,
    description: DEFAULT_TEMPLATE_DESCRIPTION,
    content: DEFAULT_TEMPLATE_CONTENT,
    isDefault: true,
  };

  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="contract-template-new">
      <CollectionBackLink href="/contracts/templates" label="Contract Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader title="New Template" description="Create a reusable contract template with merge fields." />
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Template editor</CardTitle>
          <CardDescription>
            Use {"{{merge_field}}"} tokens — they are replaced with real data when a contract is generated.
            Click any field in the reference panel to copy it.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <TemplateForm template={starter as ContractTemplate} />
        </CardContent>
      </Card>
    </div>
  );
}
