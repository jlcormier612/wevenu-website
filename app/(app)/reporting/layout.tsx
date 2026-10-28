import type { Metadata } from "next";

import { ReportsLayoutShell } from "@/components/reporting/reports-layout-shell";

export const metadata: Metadata = { title: "Reports" };

/**
 * Work Package R1 — the Reports shell. Deliberately not the Dashboard
 * (brief §2/§63): the Dashboard answers "what needs my attention today,"
 * Reports answers "how is my business performing." Five shallow tabs,
 * no nested sub-navigation (brief §61).
 *
 * Saved Reports (/reporting/saved) is also a Library collection entry
 * (alongside Brochures); the shell adds ← Templates there only.
 */
export default function ReportingLayout({ children }: { children: React.ReactNode }) {
  return <ReportsLayoutShell>{children}</ReportsLayoutShell>;
}
