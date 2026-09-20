import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch } from "lucide-react";

import { PipelineBoard } from "@/components/leads/pipeline-board";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensureStandardSalesPipelineForCurrentVenue, getLeads } from "@/lib/leads/service";
import { getActiveTemplate } from "@/lib/pipeline-templates/service";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  await ensureStandardSalesPipelineForCurrentVenue();
  const [inventory, activeTemplate] = await Promise.all([getLeads(), getActiveTemplate()]);
  const venueStages = activeTemplate?.stages?.length ? activeTemplate.stages : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description={
          venueStages
            ? `Stages follow ${activeTemplate!.name}. Booked and Lost are outcomes. Active stages are the sales work. Open Booked in Clients.`
            : "Drag a lead to move it to a different stage. Booked and Lost are outcomes, not active sales work."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/library/pipeline-templates" />}>
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />Customize Pipeline
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/leads" />}>List view</Button>
          </div>
        }
      />

      <PipelineBoard leads={inventory} venueStages={venueStages} />
    </div>
  );
}
