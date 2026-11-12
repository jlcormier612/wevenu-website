import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardFocusIsland } from "@/components/dashboard/dashboard-focus-island";
import { DashboardHeaderIsland } from "@/components/dashboard/dashboard-header-island";
import {
  DashboardFocusFallback,
  DashboardHeaderFallback,
  DashboardSnapshotFallback,
} from "@/components/dashboard/dashboard-section-fallbacks";
import { DashboardSnapshotIsland } from "@/components/dashboard/dashboard-snapshot-island";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Venue Dashboard — concise awareness / briefing surface.
 *
 * Section order (must stay distinct):
 *   1. Greeting
 *   2. Business Snapshot — compact business-state numbers (not Reports)
 *   3. Today's Focus — what requires attention TODAY (actionable NOW)
 *   4. Luv
 *   5. Coming up — what's coming (awareness, not another task queue)
 *   6. View Reports
 *
 * Wave C2: header, snapshot, and focus stream in parallel Suspense islands.
 * getDashboardData / getBusinessSnapshot are request-scoped (React cache).
 */
export default function DashboardPage() {
  return (
    <div
      className="htc-hospitality-page space-y-4 sm:space-y-6"
      data-testid="dashboard-streaming-root"
    >
      <Suspense fallback={<DashboardHeaderFallback />}>
        <DashboardHeaderIsland />
      </Suspense>

      <Suspense fallback={<DashboardSnapshotFallback />}>
        <DashboardSnapshotIsland />
      </Suspense>

      <Suspense fallback={<DashboardFocusFallback />}>
        <DashboardFocusIsland />
      </Suspense>
    </div>
  );
}
