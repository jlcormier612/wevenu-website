/**
 * Dashboard Component System — canonical Attention List (Phase 1, Step 2).
 *
 * Implements docs/dashboard-component-system-architecture.md §2.2.
 * Replaces the shell duplicated across NeedsAttentionWidget,
 * FollowupsWidget, UpcomingToursWidget, ClientEventsWidget,
 * AttentionList — shared shell for NeedsAttention, FollowUpsDue,
 * and TasksWidget — each of those keeps its own
 * per-row content (which genuinely differs row to row: some widgets show
 * a status badge, some a two-line date block, some an urgency label) and
 * now supplies that content to this component instead of duplicating the
 * Card/CardHeader/empty-state/row-container chrome around it.
 *
 * `rowVariant` preserves the one real structural difference the inventory
 * found between these widgets: most use a divide-y list (no per-row
 * border), TasksWidget use individually bordered rows.
 * Both are legitimate, existing, distinct visual treatments — this
 * component keeps both rather than forcing one at the cost of a real
 * visual regression.
 *
 * `headerBand` passes through to DashboardCardShell so Today's Focus can
 * use an eucalyptus header while Coming up stays quiet white.
 */
import type { ReactNode } from "react";
import { DashboardCardShell } from "@/components/dashboard-system/dashboard-card-shell";
import { cn } from "@/lib/utils";

export function AttentionList<T>({
  icon,
  title,
  description,
  headerRight,
  headerBand = "none",
  className,
  items,
  getKey,
  renderRow,
  rowVariant = "divider",
  emptyState,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  headerRight?: ReactNode;
  headerBand?: "eucalyptus" | "none";
  className?: string;
  items: T[];
  getKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  rowVariant?: "divider" | "bordered";
  emptyState: ReactNode;
}) {
  return (
    <DashboardCardShell
      icon={icon}
      title={title}
      description={description}
      headerRight={headerRight}
      headerBand={headerBand}
      className={className}
      isEmpty={items.length === 0}
      emptyState={emptyState}
    >
      <div className={cn(rowVariant === "divider" ? "divide-y divide-border" : "space-y-2")}>
        {items.map((item) => (
          <div key={getKey(item)}>{renderRow(item)}</div>
        ))}
      </div>
    </DashboardCardShell>
  );
}
