import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LibraryPreviewChrome } from "@/components/library/library-preview-chrome";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <LibraryPreviewChrome
      caption="Contract template preview — readable signing presentation. Merge fields fill when you create a working contract."
      editHref={`/contracts/templates/${template.id}/edit`}
      libraryHref="/library/contracts"
      contentMaxWidthClassName="max-w-xl"
      actions={
        !template.isArchived ? (
          <Button size="sm" render={<Link href={`/contracts/new?templateId=${template.id}`} />}>
            {LIBRARY_LABELS.useTemplate}
          </Button>
        ) : null
      }
    >
      <div className="space-y-4 pb-10">
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
      </div>
    </LibraryPreviewChrome>
  );
}
