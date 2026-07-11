import type { Metadata } from "next";

import { PipelineTemplateForm } from "@/components/settings/pipeline-template-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "New Pipeline Template" };

export default function NewPipelineTemplatePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New Pipeline Template" description="Build an ordered set of stages. Nothing here affects your current Leads pipeline yet." />
      <Card>
        <CardHeader>
          <CardTitle>Pipeline editor</CardTitle>
          <CardDescription>Drag stages to reorder them. Each stage maps to a fixed canonical stage used for reporting.</CardDescription>
        </CardHeader>
        <CardContent>
          <PipelineTemplateForm />
        </CardContent>
      </Card>
    </div>
  );
}
