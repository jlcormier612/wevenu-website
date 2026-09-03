import type { Metadata } from "next";
import Link from "next/link";

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
        description="Automated follow-ups that go out on their own — a Welcome Automation for new inquiries, a Reminder Automation before a tour. Communication should never require you to remember what to send next."
        actions={
          <Button render={<Link href="/communication/series/new" />}>+ New Automation</Button>
        }
      />

      {series.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No automations yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Build a set of steps that send automatically — on their own schedule, from your Templates.
          </p>
          <Button render={<Link href="/communication/series/new" />}>+ New Automation</Button>
        </div>
      ) : (
        <SeriesList initialSeries={series} />
      )}
    </div>
  );
}
