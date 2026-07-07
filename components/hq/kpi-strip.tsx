import type { BetaOverviewSummary } from "@/lib/hq/beta-types";

export type StatusFilter = "all" | "healthy" | "at_risk" | "critical";
export type SortKey = "score" | "teamAdoptionPct" | "vendorAdoptionPct" | "coupleAdoptionPct";

type Tile = {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
  accent?: "success" | "warning" | "destructive";
};

export function KpiStrip({
  kpis,
  statusFilter,
  sortKey,
  onStatusFilter,
  onSort,
}: {
  kpis: BetaOverviewSummary["kpis"];
  statusFilter: StatusFilter;
  sortKey: SortKey;
  onStatusFilter: (f: StatusFilter) => void;
  onSort: (k: SortKey) => void;
}) {
  const tiles: Tile[] = [
    { label: "Total Beta Venues", value: String(kpis.totalVenues), active: statusFilter === "all", onClick: () => onStatusFilter("all") },
    { label: "Healthy", value: String(kpis.healthy), active: statusFilter === "healthy", onClick: () => onStatusFilter("healthy"), accent: "success" },
    { label: "At Risk", value: String(kpis.atRisk), active: statusFilter === "at_risk", onClick: () => onStatusFilter("at_risk"), accent: "warning" },
    { label: "Critical", value: String(kpis.critical), active: statusFilter === "critical", onClick: () => onStatusFilter("critical"), accent: "destructive" },
    { label: "Avg Activation", value: `${kpis.avgActivationPct}%`, active: sortKey === "score", onClick: () => onSort("score") },
    { label: "Avg Team Adoption", value: `${kpis.avgTeamAdoptionPct}%`, active: sortKey === "teamAdoptionPct", onClick: () => onSort("teamAdoptionPct") },
    { label: "Avg Vendor Adoption", value: `${kpis.avgVendorAdoptionPct}%`, active: sortKey === "vendorAdoptionPct", onClick: () => onSort("vendorAdoptionPct") },
    { label: "Avg Couple Adoption", value: `${kpis.avgCoupleAdoptionPct}%`, active: sortKey === "coupleAdoptionPct", onClick: () => onSort("coupleAdoptionPct") },
  ];

  const accentClass: Record<NonNullable<Tile["accent"]>, string> = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {tiles.map((tile) => (
        <button
          key={tile.label}
          type="button"
          onClick={tile.onClick}
          className={`rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 ${tile.active ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "bg-card"}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
          <p className={`mt-1 text-2xl font-bold font-heading ${tile.accent ? accentClass[tile.accent] : "text-heading"}`}>{tile.value}</p>
        </button>
      ))}
    </div>
  );
}
