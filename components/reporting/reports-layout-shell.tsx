"use client";

import { usePathname } from "next/navigation";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { ReportTabs } from "@/components/reporting/report-tabs";
import { PageHeader } from "@/components/shell/module-placeholder";

/**
 * Reports shell. Collection back link returns to Templates; tabs navigate within Reports.
 * Saved tab uses the primary title "Saved Reports" (no second PageHeader below tabs).
 */
export function ReportsLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onSaved = pathname === "/reporting/saved" || pathname.startsWith("/reporting/saved/");

  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase10="reporting">
      <CollectionBackLink href="/library" label="Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title={onSaved ? "Saved Reports" : "Reports"}
          description={
            onSaved
              ? "Reports you've saved so you can reopen them quickly or have them delivered."
              : "How your business is doing — bookings, revenue, sales, and events."
          }
        />
      </div>
      <ReportTabs />
      {children}
    </div>
  );
}
