import type { Metadata } from "next";

import { ReportHeader } from "@/components/reporting/report-header";
import { SavedReportList } from "@/components/reporting/saved-report-list";
import { getSavedReports } from "@/lib/saved-reports/service";

export const metadata: Metadata = { title: "Saved Reports" };

export default async function SavedReportsPage() {
  const { ensureSavedReportStartersForCurrentVenue } = await import("@/lib/saved-reports/provision");
  await ensureSavedReportStartersForCurrentVenue();
  const reports = await getSavedReports();
  return (
    <div className="space-y-5 sm:space-y-6">
      <ReportHeader
        title="Saved"
        description="Reports you've saved so you can reopen them quickly or have them delivered. Starters for Sales, Bookings, Revenue, and Events are ready to open."
      />
      <SavedReportList reports={reports} />
    </div>
  );
}
