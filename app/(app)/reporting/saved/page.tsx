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
    <div className="space-y-6">
      <PageHeader
        title="Saved Reports"
        description="Reports you've saved so you can quickly return to them, or have them delivered to you. Hello to Cheers starters point at Sales, Bookings, Revenue, and Events."
      />
      <SavedReportList reports={reports} />
    </div>
  );
}
