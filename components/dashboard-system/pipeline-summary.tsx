/**
 * Dashboard Component System — canonical Pipeline Summary (Phase 2).
 *
 * Implements docs/dashboard-component-system-architecture.md §2.5.
 * Replaces the shell duplicated between dashboard/pipeline-snapshot.tsx
 * and analytics/lead-funnel-card.tsx — both are an ordered list of
 * proportional-width stage bars, but each stage row's own content
 * genuinely differs (PipelineSnapshot: a status badge + Link, whole row
 * clickable; LeadFunnelCard: a plain label + count/pct + per-stage color
 * from a fixed palette, not a link). Same shell-plus-row-renderer pattern
 * as AttentionList (Phase 1) for the same reason: consolidate what's
 * actually identical, keep what's genuinely different as caller-supplied
 * content instead of forcing a false single row shape.
 */
import type { ReactNode } from "react";
import { DashboardCardShell } from "@/components/dashboard-system/dashboard-card-shell";

export function PipelineSummary<T>({
  title,
  description,
  headerRight,
  headerClassName,
  stages,
  getKey,
  renderStage,
  footer,
}: {
  title: string;
  description?: string;
  headerRight?: ReactNode;
  headerClassName?: string;
  stages: T[];
  getKey: (stage: T) => string;
  renderStage: (stage: T) => ReactNode;
  /** Bespoke trailing content (LeadFunnelCard's "lost" divider + by-source breakdown). */
  footer?: ReactNode;
}) {
  return (
    <DashboardCardShell title={title} description={description} headerRight={headerRight} headerClassName={headerClassName} isEmpty={false} emptyState={null}>
      <div className="space-y-3">
        {stages.map((stage) => (
          <div key={getKey(stage)}>{renderStage(stage)}</div>
        ))}
      </div>
      {footer}
    </DashboardCardShell>
  );
}
