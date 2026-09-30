import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch } from "lucide-react";

import { LeadList } from "@/components/leads/lead-list";
import {
  LEADS_SPOT_PATTERN_TYPES,
  SpotPatternRecommendationsPanel,
} from "@/components/luv/spot-pattern-recommendations";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensureStandardSalesPipelineForCurrentVenue, getLeads } from "@/lib/leads/service";

export const metadata: Metadata = { title: "Leads" };

type Props = { searchParams: Promise<{ attention?: string; view?: string }> };

export default async function LeadsPage({ searchParams }: Props) {
  await ensureStandardSalesPipelineForCurrentVenue();
  const leads = await getLeads();
  const { attention, view } = await searchParams;
  const initialOutcome = view === "lost" ? "lost" as const : "active" as const;
  const initialAttention = initialOutcome === "lost"
    ? null
    : attention === "stale_contact" ? "stale_contact" as const
    : attention === "open" ? "open" as const
    : attention === "active" ? "open" as const
    : attention === "unseen" ? "unseen" as const
    : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Active sales opportunities. All is that population. Booked and Lost stay visible as outcomes and are not included in All."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/library/pipeline-templates" />}>
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />Customize Pipeline
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/leads/pipeline" />}>Board view</Button>
            <Button variant="outline" render={<Link href="/settings/import?type=leads" />}>Import Leads</Button>
            <Button render={<Link href="/leads/new" />}>+ New Lead</Button>
          </div>
        }
      />
      <SpotPatternRecommendationsPanel types={LEADS_SPOT_PATTERN_TYPES} />
      <LeadList
        leads={leads}
        initialAttention={initialAttention}
        initialOutcome={initialOutcome}
      />
    </div>
  );
}
