import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";

import { AutomationsHelp } from "@/components/communication/automations-help";
import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { SeriesList } from "@/components/communication/series-list";
import { NavListBodyFallback } from "@/components/shell/nav-list-body-fallback";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensureStarterAutomationsForCurrentVenue } from "@/lib/message-sequences/provision";
import { getSequences } from "@/lib/message-sequences/service";

export const metadata: Metadata = { title: "Automations" };

async function AutomationsBodyIsland() {
  const series = await getSequences();

  if (series.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card py-16 text-center">
        <p className="font-heading text-lg font-medium text-heading">No automations yet</p>
        <p className="mt-1 mb-4 max-w-md text-sm text-muted-foreground">
          Start with a new-inquiry welcome, a tour thank-you, or a sales follow-up. You can preview
          what will happen before you turn it on.
        </p>
        <Button render={<Link href="/communication/series/new" />}>+ New Automation</Button>
      </div>
    );
  }

  return <SeriesList initialSeries={series} />;
}

export default function SeriesPage() {
  // Keep starter ensure off the critical path (same pattern as Leads pipeline ensure).
  after(() => {
    void ensureStarterAutomationsForCurrentVenue().catch((err: unknown) => {
      console.error(
        JSON.stringify({
          event: "automations_starter_ensure_failed",
          message: err instanceof Error ? err.message : "unknown",
        }),
      );
    });
  });

  return (
    <div
      className="htc-hospitality-page space-y-5 sm:space-y-6"
      data-htc-phase12="automations"
      data-testid="automations-streaming-root"
    >
      <SetupHubReturnLink
        href="/setup-hub/make-htc-yours/communications"
        label="Back to your communications"
      />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Automations"
          description="When something happens, Hello to Cheers can send the right follow-up for you — for sales leads and for booked clients."
          actions={
            <Button render={<Link href="/communication/series/new" />}>+ New Automation</Button>
          }
        />
      </div>

      <AutomationsHelp />

      <Suspense fallback={<NavListBodyFallback label="Loading automations" />}>
        <AutomationsBodyIsland />
      </Suspense>
    </div>
  );
}
