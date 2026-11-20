import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { GitBranch } from "lucide-react";

import { LeadsListIsland } from "@/components/leads/leads-list-island";
import {
  LEADS_SPOT_PATTERN_TYPES,
  SpotPatternRecommendationsPanel,
} from "@/components/luv/spot-pattern-recommendations";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensureStandardSalesPipelineForCurrentVenue } from "@/lib/leads/service";

export const metadata: Metadata = { title: "Leads" };

type Props = {
  searchParams: Promise<{
    attention?: string;
    view?: string;
    q?: string;
    stage?: string;
    eventType?: string;
    sort?: string;
  }>;
};

function LeadsListFallback() {
  return (
    <div
      className="space-y-3 rounded-[0.75rem] border border-[color:var(--htc-border-warm)] bg-card/40 p-4"
      role="status"
      aria-busy="true"
      aria-label="Loading leads list"
      data-testid="leads-list-fallback"
    >
      <div className="h-9 max-w-md animate-pulse rounded-md bg-[var(--htc-eucalyptus-surface-pale)]" />
      <div className="h-8 max-w-xl animate-pulse rounded-md bg-[var(--htc-eucalyptus-surface-pale)] opacity-80" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-md bg-[var(--htc-eucalyptus-surface-pale)]"
            style={{ opacity: 1 - i * 0.08 }}
          />
        ))}
      </div>
    </div>
  );
}

async function LeadsSpotIsland() {
  return <SpotPatternRecommendationsPanel types={LEADS_SPOT_PATTERN_TYPES} />;
}

export default async function LeadsPage({ searchParams }: Props) {
  const params = await searchParams;

  // Wave 1: keep Standard pipeline idempotent ensure off the list critical path.
  // Board view + venue provisioning still await ensure for first-use correctness.
  after(() => {
    void ensureStandardSalesPipelineForCurrentVenue();
  });

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6" data-testid="leads-streaming-root">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Leads"
          description="Active sales opportunities. All is that population. Booked and Lost stay visible as outcomes and are not included in All."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" render={<Link href="/library/pipeline-templates" />}>
                <GitBranch className="mr-1.5 h-3.5 w-3.5" />Customize Pipeline
              </Button>
              <Button variant="outline" size="sm" render={<Link href="/leads/pipeline" />}>Board View</Button>
              <Button variant="outline" render={<Link href="/setup-hub/bring-your-business?stage=leads" />}>Import Leads</Button>
              <Button render={<Link href="/leads/new" />}>+ New Lead</Button>
            </div>
          }
        />
      </div>
      <Suspense fallback={null}>
        <LeadsSpotIsland />
      </Suspense>
      <Suspense fallback={<LeadsListFallback />}>
        <LeadsListIsland searchParams={params} />
      </Suspense>
    </div>
  );
}
