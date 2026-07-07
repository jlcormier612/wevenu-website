"use client";

import * as React from "react";

import { BetaVenueTable } from "@/components/hq/beta-venue-table";
import { KpiStrip, type SortKey, type StatusFilter } from "@/components/hq/kpi-strip";
import type { BetaOverviewSummary } from "@/lib/hq/beta-types";

/**
 * Beta Command Center home. Answers "which customers need our attention
 * today" first (KPI strip + health/risk-forward columns) before "how many
 * customers do we have" — see docs/wevenu-hq-architecture.md §2's core
 * principle. Every KPI tile drills into the list below it (QC's
 * click-a-tile-to-filter pattern — see §2.1).
 */
export function BetaCommandCenter({ data }: { data: BetaOverviewSummary }) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("score");

  function handleStatusFilter(f: StatusFilter) {
    setStatusFilter(f);
  }

  function handleSort(k: SortKey) {
    setSortKey((prev) => (prev === k ? "score" : k));
  }

  const filtered = React.useMemo(() => {
    const list = statusFilter === "all" ? data.venues : data.venues.filter((v) => v.healthStatus === statusFilter);
    return [...list].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [data.venues, statusFilter, sortKey]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-heading">Beta Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Which venues need our attention today — activation, health, and adoption across the beta cohort.
        </p>
      </div>

      <KpiStrip
        kpis={data.kpis}
        statusFilter={statusFilter}
        sortKey={sortKey}
        onStatusFilter={handleStatusFilter}
        onSort={handleSort}
      />

      <BetaVenueTable venues={filtered} />
    </div>
  );
}
