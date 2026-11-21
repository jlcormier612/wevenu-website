"use client";

import { ReportTabs } from "@/components/reporting/report-tabs";
import { PageHeader } from "@/components/shell/module-placeholder";

/**
 * Reports shell. Primary title stays "Reports" on every tab (including Saved).
 * No back-link to Templates — Reports is a top-level sidebar destination.
 */
export function ReportsLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase10="reporting">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Reports"
          description="How your business is doing — bookings, revenue, sales, and events."
        />
      </div>
      <ReportTabs />
      {children}
    </div>
  );
}
