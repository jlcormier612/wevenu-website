/**
 * Dashboard Component System — canonical Stat Tile (Phase 1 Step 3, Phase 2
 * completion).
 *
 * Implements docs/dashboard-component-system-architecture.md §2.1.
 * Phase 1 migrated 1 of 9 identified instances (stat-bar.tsx) using only
 * the "icon" layout. Phase 2 migrates the remaining 8. Reading each of
 * those 8 in full surfaced real, legitimate structural variance the
 * architecture doc's own spec already allows for ("an optional icon" —
 * §2.1's own wording) — three distinct layouts, not one:
 *   - "icon": icon chip + value/label stacked (stat-bar's original shape)
 *   - "label-top": small uppercase label above a big value, no icon
 *     (legal-dashboard-cards, admin/analytics, admin/system-health's
 *     HeartbeatPill, kpi-strip, analytics/events-card's StatBox)
 *   - "value-top": a value first, label below, optionally centered
 *     (messaging/health's inline row, events/request-summary-card)
 * Every prop below exists because a real call site needed it to keep its
 * exact current appearance — none were added speculatively.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/dashboard-system/severity";
import { SEVERITY_CONFIG } from "@/lib/dashboard-system/severity";

/**
 * shadcn's <Card> bakes in `ring-1 shadow-sm` plus CSS-variable-based
 * padding — correct for the "icon" layout (stat-bar.tsx's original
 * StatCard already used shadcn Card/CardContent, confirmed by direct
 * read). Every "label-top"/"value-top" call site migrated in Phase 2
 * used a *plain* `<div>` instead — wrapping those in shadcn Card would
 * silently add a shadow/ring/padding none of them have today, a real
 * visual regression. Those two layouts render a plain div instead,
 * exactly matching each original.
 */

export type StatTileLayout = "icon" | "label-top" | "value-top";

export function StatTile({
  icon: Icon,
  value,
  label,
  sub,
  href,
  onClick,
  active,
  severity,
  layout = "icon",
  align = "left",
  size = "md",
  valueClassName,
  className,
}: {
  icon?: React.ElementType;
  value: number | string;
  label: string;
  /** Optional secondary line below the value (events-card's StatBox). */
  sub?: string;
  href?: string;
  onClick?: () => void;
  /** Toggled/selected state — the filter/sort tiles in kpi-strip.tsx. */
  active?: boolean;
  severity?: Severity;
  layout?: StatTileLayout;
  align?: "left" | "center";
  /** Value text size — "sm" matches request-summary-card's smaller in-card tiles. */
  size?: "sm" | "md";
  /** Override for the value's own text color (e.g. HeartbeatPill's stale/fresh color, independent of severity's tile tint). */
  valueClassName?: string;
  /** Escape hatch for a call site's own container padding/radius/background that doesn't match either default (kept narrow — every current use is documented in the migrations, not a general styling prop). */
  className?: string;
}) {
  const activeValue = severity && (typeof value !== "number" || value > 0);
  const config = activeValue ? SEVERITY_CONFIG[severity] : null;
  const interactive = Boolean(href || onClick);

  const valueSize = size === "sm" ? "text-xl" : "text-2xl";

  let body: ReactNode;
  if (layout === "icon" && Icon) {
    body = (
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm",
            config ? config.bgClass : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className={cn(valueSize, "font-semibold leading-none", (config ? config.textColor : "text-heading"), valueClassName)}>
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    );
  } else if (layout === "value-top") {
    body = (
      <div className={cn(align === "center" && "text-center")}>
        <p className={cn(valueSize, "font-bold", (config ? config.textColor : "text-foreground"), valueClassName)}>
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    );
  } else {
    // "label-top"
    body = (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-1", valueSize, "font-bold font-heading", (config ? config.textColor : "text-heading"), valueClassName)}>
          {value}
        </p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    );
  }

  // "icon" reuses shadcn Card/CardContent exactly as stat-bar.tsx's
  // original StatCard did (confirmed by direct read). "label-top" and
  // "value-top" render a plain div with a fully caller-supplied
  // className — every one of their real call sites used a plain div,
  // not shadcn Card, and each has its own distinct border/radius/
  // background/padding; a shared default here would either invent a
  // look none of them have or silently add shadcn Card's ring/shadow to
  // sites that never had one.
  const tintClass = cn(config?.cardTint, active && "border-primary ring-1 ring-primary/40 bg-primary/5");

  // h-full so a tile in a CSS grid row stretches to the tallest sibling.
  // Without it, the grid cell grows but the bordered surface stays content-
  // sized — Business Snapshot's Upcoming tile (no `sub`) looked shorter than
  // Active Leads / Payments to Watch even though they share one row.
  const content =
    layout === "icon" ? (
      <Card className={cn("h-full transition-colors", tintClass, className)}>
        <CardContent className="p-4">{body}</CardContent>
      </Card>
    ) : (
      <div className={cn("h-full transition-colors", tintClass, className)}>{body}</div>
    );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block h-full w-full text-left">
        {content}
      </button>
    );
  }
  void interactive;
  return content;
}

export function StatTileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 items-stretch gap-3 sm:grid-cols-4 [&>*]:h-full", className)}>
      {children}
    </div>
  );
}
