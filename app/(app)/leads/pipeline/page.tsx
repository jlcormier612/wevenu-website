import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch } from "lucide-react";

import { PipelineBoard } from "@/components/leads/pipeline-board";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getLeads, getPipelineStageIdsForVenue } from "@/lib/leads/service";
import { getActiveTemplate } from "@/lib/pipeline-templates/service";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const [leads, activeTemplate, stageIdsByLead] = await Promise.all([
    getLeads(),
    getActiveTemplate(),
    getPipelineStageIdsForVenue(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Drag a lead to move it to a different stage."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/library/pipeline-templates" />}>
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />Pipeline Templates
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/leads" />}>List view</Button>
          </div>
        }
      />

      {!activeTemplate || activeTemplate.stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No active Pipeline Template</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Set one up to see your leads as a board.
          </p>
          <Button variant="outline" render={<Link href="/library/pipeline-templates" />}>
            Manage Pipeline Templates
          </Button>
        </div>
      ) : (
        <PipelineBoard leads={leads} stages={activeTemplate.stages} stageIdsByLead={stageIdsByLead} />
      )}
    </div>
  );
}
