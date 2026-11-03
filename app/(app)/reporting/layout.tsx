import type { Metadata } from "next";

import { ReportsLayoutShell } from "@/components/reporting/reports-layout-shell";

export const metadata: Metadata = { title: "Reports" };

/**
 * Work Package R1 — the Reports shell. Deliberately not the Dashboard
 * (brief §2/§63): the Dashboard answers "what needs my attention today,"
 * Reports answers "how is my business performing." Five shallow tabs,
 * no nested sub-navigation (brief §61).
 *
 * Saved Reports is a Reports tab. ReportTabs provide navigation — no
 * library Templates breadcrumb on /reporting/saved (Phase 11C).
 */
export default function ReportingLayout({ children }: { children: React.ReactNode }) {
  return <ReportsLayoutShell>{children}</ReportsLayoutShell>;
}
