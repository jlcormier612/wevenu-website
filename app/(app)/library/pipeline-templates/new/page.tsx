import type { Metadata } from "next";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PipelineTemplateForm } from "@/components/settings/pipeline-template-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "New Pipeline Template" };

export default function NewPipelineTemplatePage() {
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="pipeline-template-new">
      <CollectionBackLink href="/library/pipeline-templates" label="Pipeline Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader title="New Pipeline Template" description="Build an ordered set of stages. Nothing here affects your current Leads pipeline yet." />
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Pipeline editor</CardTitle>
          <CardDescription>Drag stages to reorder them. Each stage maps to a fixed canonical stage used for reporting.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <PipelineTemplateForm />
        </CardContent>
      </Card>
    </div>
  );
}
