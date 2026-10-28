"use client";

import { usePathname } from "next/navigation";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { ReportTabs } from "@/components/reporting/report-tabs";
import { PageHeader } from "@/components/shell/module-placeholder";

/**
 * Reports shell. Saved Reports is also a Library collection (like Brochures),
 * so on /reporting/saved we show the established ← Templates escape above the
 * shared Reports heading + tabs.
 */
export function ReportsLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showTemplatesBack = pathname === "/reporting/saved";

  return (
    <div className="space-y-6">
      {showTemplatesBack ? <CollectionBackLink href="/library" label="Templates" /> : null}
      <PageHeader title="Reports" description="How your business is doing — bookings, revenue, sales, and events." />
      <ReportTabs />
      {children}
    </div>
  );
}
