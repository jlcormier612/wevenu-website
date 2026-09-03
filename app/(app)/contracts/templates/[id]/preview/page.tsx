import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { formatRelative } from "@/lib/leads/constants";
import { getTemplate } from "@/lib/contracts/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Preview — ${template.name}` : "Preview template" };
}

export default async function ContractTemplatePreviewPage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 max-w-xl mx-auto">
        <p className="text-sm text-muted-foreground">Preview as your clients will see it</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" render={<Link href={`/contracts/templates/${template.id}/edit`} />}>
            Back to edit
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/library/contracts" />}>
            Library
          </Button>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 pb-10 space-y-4">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-medium text-heading">{template.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Contract Template</span>
            {template.sourceMasterKey && <Badge variant="muted" className="text-[10px]">{LIBRARY_LABELS.starter}</Badge>}
            {template.isDefault && <Badge variant="default" className="text-[10px]">Default</Badge>}
            <span>· Updated {formatRelative(template.updatedAt)}</span>
          </div>
          {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
        </div>
        <div className="rounded-lg border border-border bg-background p-6 font-sans text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {template.content}
        </div>
        {!template.isArchived && (
          <div className="flex justify-end">
            <Button size="sm" render={<Link href={`/contracts/new?templateId=${template.id}`} />}>
              {LIBRARY_LABELS.useTemplate}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
