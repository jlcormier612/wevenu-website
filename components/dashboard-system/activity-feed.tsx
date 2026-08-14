/**
 * Dashboard Component System — canonical Activity Feed (Phase 1, Step 6).
 *
 * Implements docs/dashboard-component-system-architecture.md §2.3 — the
 * chronological, non-actionable, grid-laid-out sibling of Attention List
 * (§2.2). Replaces RecentActivityWidget's own copy of the card shell,
 * keeping its exact grid layout and row content unchanged.
 */
import type { ReactNode } from "react";
import { DashboardCardShell } from "@/components/dashboard-system/dashboard-card-shell";

export function ActivityFeed<T>({
  title,
  description,
  entries,
  getKey,
  renderEntry,
  emptyState,
}: {
  title: string;
  description?: string;
  entries: T[];
  getKey: (entry: T) => string;
  renderEntry: (entry: T) => ReactNode;
  emptyState: ReactNode;
}) {
  return (
    <DashboardCardShell
      title={title}
      description={description}
      isEmpty={entries.length === 0}
      emptyState={emptyState}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <div key={getKey(entry)}>{renderEntry(entry)}</div>
        ))}
      </div>
    </DashboardCardShell>
  );
}
