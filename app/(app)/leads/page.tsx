import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch } from "lucide-react";

import { LeadList } from "@/components/leads/lead-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getLeads, getPipelineStageIdsForVenue } from "@/lib/leads/service";
import { getActiveTemplate } from "@/lib/pipeline-templates/service";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage() {
  const [leads, activeTemplate, stageIdsByLead] = await Promise.all([
    getLeads(),
    getActiveTemplate(),
    getPipelineStageIdsForVenue(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Manage inquiries and track them through your booking pipeline."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/library/pipeline-templates" />}>
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />Pipeline Templates
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/leads/pipeline" />}>Board view</Button>
            <Button variant="outline" render={<Link href="/settings/import?type=leads" />}>Import Leads</Button>
            <Button render={<Link href="/leads/new" />}>+ New Inquiry</Button>
          </div>
        }
      />
      <LeadList leads={leads} pipelineStages={activeTemplate?.stages ?? []} stageIdsByLead={stageIdsByLead} />
    </div>
  );
}
