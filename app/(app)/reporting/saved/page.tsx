import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SavedReportList } from "@/components/reporting/saved-report-list";
import { getSavedReports } from "@/lib/saved-reports/service";

export const metadata: Metadata = { title: "Saved Reports" };

export default async function SavedReportsPage() {
  const { ensureSavedReportStartersForCurrentVenue } = await import("@/lib/saved-reports/provision");
  await ensureSavedReportStartersForCurrentVenue();
  const reports = await getSavedReports();
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6">
      <PageHeader title="Saved Reports" />
      <section className="htc-surface-guidance space-y-1 px-4 py-3" aria-label="About Saved Reports">
        <p className="text-sm font-semibold text-heading">About Saved Reports</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Reports you&apos;ve saved so you can reopen them quickly or have them delivered. Starters for
          Sales, Bookings, Revenue, and Events are ready to open.
        </p>
      </section>
      <SavedReportList reports={reports} />
    </div>
  );
}
