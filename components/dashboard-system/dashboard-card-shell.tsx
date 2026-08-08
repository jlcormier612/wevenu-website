/**
 * Dashboard Component System — shared card shell (Phase 1, Step 2 support).
 *
 * The Card > CardHeader(icon+title, optional header-right, description) >
 * CardContent > (empty state | content) structure duplicated, byte-for-
 * byte, across every one of the 8 Attention List widgets and Recent
 * Activity's Activity Feed variant (docs/dashboard-component-system-
 * architecture.md §1). Attention List and Activity Feed both compose this
 * shell rather than each re-declaring it.
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
  isEmpty: boolean;
  emptyState: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className={cn(headerClassName)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
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
