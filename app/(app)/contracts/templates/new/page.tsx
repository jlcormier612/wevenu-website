import type { Metadata } from "next";

import { TemplateForm } from "@/components/contracts/template-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TEMPLATE_CONTENT, DEFAULT_TEMPLATE_DESCRIPTION, DEFAULT_TEMPLATE_NAME } from "@/lib/contracts/constants";
import type { ContractTemplate } from "@/lib/contracts/types";

export const metadata: Metadata = { title: "New Template" };

export default function NewTemplatePage() {
  // Seed the starter template for new venues
  const starter: Partial<ContractTemplate> = {
    name: DEFAULT_TEMPLATE_NAME,
    description: DEFAULT_TEMPLATE_DESCRIPTION,
    content: DEFAULT_TEMPLATE_CONTENT,
    isDefault: true,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New Template" description="Create a reusable contract template with merge fields." />
      <Card>
        <CardHeader>
          <CardTitle>Template editor</CardTitle>
          <CardDescription>
            Use {"{{merge_field}}"} tokens — they are replaced with real data when a contract is generated.
            Click any field in the reference panel to copy it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateForm template={starter as ContractTemplate} />
        </CardContent>
      </Card>
    </div>
  );
}
