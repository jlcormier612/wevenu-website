import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getTemplate } from "@/lib/pipeline-templates/service";
import { canonicalStageLabel } from "@/lib/pipeline-templates/constants";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `${template.name} — Pipeline Preview` : "Pipeline Template Preview" };
}

export default async function PipelineTemplatePreviewPage({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/library/pipeline-templates"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Pipeline Templates
        </Link>
      </div>

      <PageHeader
        title={template.name}
        description="Preview the stages exactly as this pipeline is configured. Nothing changes while you are previewing."
        actions={
          <Button render={<Link href={`/library/pipeline-templates/${id}/edit`} />}>
            Edit template
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-5xl rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="mb-6 space-y-1">
          <p className="text-sm font-medium text-heading">{template.name}</p>
          {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
        </div>

        <div className="space-y-2">
          {template.stages.map((stage, index) => (
            <div
              key={stage.id}
              className="flex items-center gap-4 rounded-lg border border-border px-4 py-3"
            >
              <span className="w-6 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: stage.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-heading">{stage.name}</p>
                <p className="text-xs text-muted-foreground">{canonicalStageLabel(stage.canonicalStage)}</p>
              </div>
              {stage.probability != null && (
                <span className="text-xs text-muted-foreground">{stage.probability}%</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
