"use client";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { ReportTabs } from "@/components/reporting/report-tabs";
import { PageHeader } from "@/components/shell/module-placeholder";

/**
 * Reports shell. Collection back link returns to Templates; tabs navigate within Reports.
 */
export function ReportsLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase10="reporting">
      <CollectionBackLink href="/library" label="Templates" />
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
