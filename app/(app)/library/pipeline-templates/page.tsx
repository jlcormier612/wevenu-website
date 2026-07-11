import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant={t.isActive ? "success" : "muted"} className="text-[10px]">
                    {t.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {t.description && <CardDescription>{t.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" render={<Link href={`/library/pipeline-templates/${t.id}/edit`} />}>
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
