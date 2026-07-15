import type { Metadata } from "next";
import Link from "next/link";

import { PipelineTemplateList } from "@/components/settings/pipeline-template-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getTemplates } from "@/lib/pipeline-templates/service";

export const metadata: Metadata = { title: "Pipeline Templates" };

export default async function PipelineTemplatesPage() {
  const templates = await getTemplates();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline Templates"
        description="Reusable, stage-by-stage pipelines you can build and customize. Not connected to Leads yet — this is just the editor."
        actions={
          <Button render={<Link href="/library/pipeline-templates/new" />}>+ New Pipeline Template</Button>
        }
      />

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No pipeline templates yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Build a set of stages your venue moves inquiries through.
          </p>
          <Button render={<Link href="/library/pipeline-templates/new" />}>+ New Pipeline Template</Button>
        </div>
      ) : (
        <PipelineTemplateList initialTemplates={templates} />
      )}
    </div>
  );
}
