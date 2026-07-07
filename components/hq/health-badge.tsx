import type { HealthStatus, Trend } from "@/lib/hq/beta-types";

const HEALTH_META: Record<HealthStatus, { label: string; className: string }> = {
  healthy:  { label: "Healthy", className: "bg-success/15 text-success" },
  at_risk:  { label: "At Risk", className: "bg-warning/15 text-warning" },
  critical: { label: "Critical", className: "bg-destructive/15 text-destructive" },
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  const meta = HEALTH_META[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

const TREND_META: Record<Trend, { label: string; symbol: string; className: string }> = {
  improving: { label: "Improving", symbol: "↗", className: "text-success" },
  declining: { label: "Declining", symbol: "↘", className: "text-destructive" },
  flat:      { label: "Flat",      symbol: "→", className: "text-muted-foreground" },
  unknown:   { label: "No history yet", symbol: "·", className: "text-muted-foreground/60" },
};

export function TrendIndicator({ trend }: { trend: Trend }) {
  const meta = TREND_META[trend];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`} title={meta.label}>
      <span aria-hidden>{meta.symbol}</span>
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}
