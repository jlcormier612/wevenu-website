import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { ReportTabs } from "@/components/reporting/report-tabs";

export const metadata: Metadata = { title: "Reporting" };

/**
 * Work Package R1 — the Reporting shell. Deliberately not the Dashboard
 * (brief §2/§63): the Dashboard answers "what needs my attention today,"
 * Reporting answers "how is my business performing." Five shallow tabs,
 * no nested sub-navigation (brief §61).
 */
export default function ReportingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Reporting" description="How your business is doing — bookings, revenue, sales, and events." />
      <ReportTabs />
      {children}
    </div>
  );
}
