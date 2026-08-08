/**
 * Dashboard Component System — shared severity primitive (Phase 1, Step 1).
 *
 * Implements docs/dashboard-component-system-architecture.md §7 exactly.
 * Every dashboard-system component reads its color/icon treatment from
 * SEVERITY_CONFIG below — no component may define its own tier→color map.
 *
 * Values are drawn from what already exists in the app today (no new
 * colors, per the implementation brief's own rule) — confirmed against
 * health-score-widget.tsx / vendor-health-score-widget.tsx / communication-
 * health-widget.tsx's identical success/warning/destructive scheme, and
 * dashboard/stat-bar.tsx's tone system (urgent/action/info/positive).
 */

export type Severity =
  | "critical"
  | "warning"
  | "opportunity"
  | "celebration"
  | "informational"
  | "historical";

export type SeverityConfig = {
  /** Tailwind text color class for the primary numeral/label. */
  textColor: string;
  /** Tailwind border color class, for card-level tinting. */
  borderColor: string;
  /** Tailwind background tint class, for icon chips (e.g. "bg-destructive/10 text-destructive"). */
  bgClass: string;
  /** Combined border+bg tint for a whole tile/card, matching stat-bar.tsx's original per-tone classes exactly. */
  cardTint: string;
  /** CSS color-mix() source, for the card-background tint pattern already used by health-score-widget.tsx. */
  bgMix: string;
  /** Small status emoji, matching the existing tier-widget convention. */
  emoji: string;
};

export const SEVERITY_CONFIG: Record<Severity, SeverityConfig> = {
  critical: {
    textColor: "text-destructive",
    borderColor: "border-destructive/20",
    bgClass: "bg-destructive/10 text-destructive",
    cardTint: "border-destructive/30 bg-destructive/5",
    bgMix: "var(--destructive)",
    emoji: "🔴",
  },
  warning: {
    textColor: "text-warning-foreground",
    borderColor: "border-warning/25",
    bgClass: "bg-warning/15 text-warning-foreground",
    cardTint: "border-warning/30 bg-warning/5",
    bgMix: "var(--warning)",
    emoji: "🟡",
  },
  opportunity: {
    textColor: "text-primary",
    borderColor: "border-primary/25",
    bgClass: "bg-primary/10 text-primary",
    cardTint: "border-primary/25 bg-primary/5",
    bgMix: "var(--primary)",
    emoji: "🔵",
  },
  celebration: {
    textColor: "text-rose-600 dark:text-rose-400",
    borderColor: "border-rose-200/40",
    bgClass: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400",
    cardTint: "border-rose-200/40 bg-rose-50/60 dark:bg-rose-950/20",
    bgMix: "var(--destructive)",
    emoji: "💗",
  },
  informational: {
    textColor: "text-heading",
    borderColor: "border-border",
    bgClass: "bg-muted text-muted-foreground",
    cardTint: "",
    bgMix: "var(--muted)",
    emoji: "",
  },
  historical: {
    textColor: "text-muted-foreground",
    borderColor: "border-border/60",
    bgClass: "bg-muted/60 text-muted-foreground",
    cardTint: "",
    bgMix: "var(--muted)",
    emoji: "",
  },
};

/** Success/healthy states map onto "informational" plus a distinct green — kept as a named alias so callers reading a 3-tier health/status enum (thriving/growing/needs_attention, excellent/attention/action_required) have one canonical mapping, not a per-component decision. */
export type HealthTierSeverity = "healthy" | Severity;

export const HEALTH_TIER_CONFIG: Record<"healthy" | "warning" | "critical", SeverityConfig> = {
  healthy: {
    textColor: "text-success",
    borderColor: "border-success/25",
    bgClass: "bg-success/10 text-success",
    cardTint: "border-success/25 bg-success/5",
    bgMix: "var(--success)",
    emoji: "🟢",
  },
  warning: SEVERITY_CONFIG.warning,
  critical: SEVERITY_CONFIG.critical,
};

/**
 * Canonical 3-tier mapping for the score-based health widgets
 * (Venue/Vendor Health, dimension bars) — the exact thresholds already
 * used by health-score-widget.tsx's DimensionBar, generalized to one
 * shared function instead of being redefined per widget.
 */
export function severityForScore(percent: number): "healthy" | "warning" | "critical" {
  if (percent >= 75) return "healthy";
  if (percent >= 50) return "warning";
  return "critical";
}
