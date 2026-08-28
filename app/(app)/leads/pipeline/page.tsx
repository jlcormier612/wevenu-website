import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch } from "lucide-react";

import { PipelineBoard } from "@/components/leads/pipeline-board";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensureStandardSalesPipelineForCurrentVenue, getLeads } from "@/lib/leads/service";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  await ensureStandardSalesPipelineForCurrentVenue();
  const leads = await getLeads();

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

      <PipelineBoard leads={leads} />
    </div>
  );
}
