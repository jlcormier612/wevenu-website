import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteTemplateAction } from "@/app/(app)/contracts/actions";
import { getTemplates } from "@/lib/contracts/service";

export const metadata: Metadata = { title: "Contract Templates" };

export default async function TemplatesPage() {
  const templates = await getTemplates();
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className={t.isDefault ? "border-primary/30" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  {t.isDefault && <Badge variant="default">Default</Badge>}
                </div>
                {t.description && <CardDescription>{t.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" render={<Link href={`/contracts/templates/${t.id}/edit`} />}>
                    Edit
                  </Button>
                  <Button size="sm" render={<Link href={`/contracts/new`} />}>
                    Use
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
