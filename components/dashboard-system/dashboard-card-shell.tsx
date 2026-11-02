/**
 * Dashboard Component System — shared card shell (Phase 1, Step 2 support).
 *
 * The Card > CardHeader(icon+title, optional header-right, description) >
 * CardContent > (empty state | content) structure duplicated, byte-for-
 * byte, across every one of the 8 Attention List widgets and Recent
 * Activity's Activity Feed variant (docs/dashboard-component-system-
 * architecture.md §1). Attention List and Activity Feed both compose this
 * shell rather than each re-declaring it.
 *
 * `headerBand="eucalyptus"` paints the header with the hospitality eucalyptus
 * surface (Today's Focus). Coming up keeps the default plain white header.
 */
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardCardShell({
  icon,
  title,
  description,
  headerRight,
  headerClassName,
  headerBand = "none",
  className,
  isEmpty,
  emptyState,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  headerRight?: ReactNode;
  /** Override for CardHeader's own className (e.g. LeadFunnelCard's original "pb-2"). */
  headerClassName?: string;
  /** Eucalyptus header band for high-priority sections (Today's Focus). */
  headerBand?: "eucalyptus" | "none";
  className?: string;
  isEmpty: boolean;
  emptyState: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[0.75rem] border-[color:var(--htc-border-warm)] ring-0",
        className,
      )}
    >
      <CardHeader
        className={cn(
          headerBand === "eucalyptus" &&
            "rounded-none bg-[var(--htc-eucalyptus-surface)] border-b border-[color:color-mix(in_oklch,var(--htc-eucalyptus)_45%,var(--htc-border-warm))]",
          headerClassName,
        )}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base text-heading">
            {icon}
            {title}
          </CardTitle>
          {headerRight}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{isEmpty ? emptyState : children}</CardContent>
    </Card>
  );
}
