import type { Metadata } from "next";
import Link from "next/link";

import { AutomationsHelp } from "@/components/communication/automations-help";
import { SeriesList } from "@/components/communication/series-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensureStarterAutomationsForCurrentVenue } from "@/lib/message-sequences/provision";
import { getSequences } from "@/lib/message-sequences/service";

export const metadata: Metadata = { title: "Automations" };

export default async function SeriesPage() {
  await ensureStarterAutomationsForCurrentVenue();
  const series = await getSequences();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        description="When something happens, Hello to Cheers can send the right follow-up for you — for sales leads and for booked clients."
        actions={
          <Button render={<Link href="/communication/series/new" />}>+ New Automation</Button>
        }
      />

      <AutomationsHelp />

      {series.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No automations yet</p>
          <p className="mt-1 mb-4 max-w-md text-sm text-muted-foreground">
            Start with a new-inquiry welcome, a tour thank-you, or a sales follow-up. You can preview what will happen before you turn it on.
          </p>
          <Button render={<Link href="/communication/series/new" />}>+ New Automation</Button>
        </div>
      ) : (
        <SeriesList initialSeries={series} />
      )}
    </div>
  );
}
