"use client";

import { ReportTabs } from "@/components/reporting/report-tabs";
import { PageHeader } from "@/components/shell/module-placeholder";

/**
 * Reports shell. Report tabs (Overview / Sales / Bookings / Revenue / Events / Saved)
 * are the primary navigation — no redundant library “Templates” breadcrumb on Saved.
 */
export function ReportsLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6" data-htc-phase10="reporting">
      <div className="htc-hospitality-intro htc-hospitality-intro-accent">
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
