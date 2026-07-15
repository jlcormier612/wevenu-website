import type { Metadata } from "next";
import Link from "next/link";

import { ContractTemplateList } from "@/components/contracts/contract-template-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getTemplates } from "@/lib/contracts/service";

export const metadata: Metadata = { title: "Contract Templates" };

export default async function TemplatesPage() {
  const templates = await getTemplates(true);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Templates"
        description="Reusable templates with merge fields for quick contract generation."
        actions={
          <Button render={<Link href="/contracts/templates/new" />}>+ New Template</Button>
        }
      />

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No templates yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Create a template to streamline contract generation.
          </p>
          <Button render={<Link href="/contracts/templates/new" />}>+ New Template</Button>
        </div>
      ) : (
        <ContractTemplateList initialTemplates={templates} />
      )}
    </div>
  );
}
