/**
 * Dashboard Component System — canonical Status Card (Phase 2).
 *
 * Implements docs/dashboard-component-system-architecture.md §2.8. Only
 * one real instance exists today (CommunicationHealthWidget), already
 * correctly reused unmodified across two surfaces (Dashboard + Reports)
 * — the cleanest existing precedent in the whole inventory. There's
 * nothing to de-duplicate; this component exists so that instance's
 * shape becomes the canonical, reusable one for future categorical
 * (non-scored) status surfaces, per the brief's own "complete the
 * remaining canonical component families" — not because a second
 * instance was found.
 *
 * Severity resolves through lib/dashboard-system/severity.ts's
 * HEALTH_TIER_CONFIG exclusively — the 3-tier healthy/warning/critical
 * set (not the 6-value Severity type), since every real Status Card
 * found (CommunicationHealthWidget's excellent/attention/action_required)
 * is this exact shape: a "good/okay/bad" categorical status, not one of
 * the taxonomy-driven Alert/Celebration/etc. tiers.
 */
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HEALTH_TIER_CONFIG } from "@/lib/dashboard-system/severity";

export type StatusCardTier = "healthy" | "warning" | "critical";
export type StatusCardIssue = { id: string; icon?: ReactNode; label: ReactNode; href?: string | null };

export function StatusCard({
  title,
  tier,
  headline,
  detail,
  issues,
  maxIssues = 4,
  renderIssueLink,
}: {
  title: string;
  tier: StatusCardTier;
  headline: string;
  detail: string;
  issues?: StatusCardIssue[];
  maxIssues?: number;
  /** Custom link wrapper for an issue row (matches CommunicationHealthWidget's own hover/underline treatment). */
  renderIssueLink?: (issue: StatusCardIssue, content: ReactNode) => ReactNode;
}) {
  const config = HEALTH_TIER_CONFIG[tier];

  return (
    <Card
      className={config.borderColor}
      style={{ background: `color-mix(in oklch, ${config.bgMix} 3%, var(--card))` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden>{config.emoji}</span>
            <h2 className="font-heading text-sm font-semibold text-heading">{title}</h2>
          </div>
          <span className={`text-xs font-semibold ${config.textColor}`}>{headline}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground">{detail}</p>
        {issues && issues.length > 0 && (
          <ul className="space-y-1.5">
            {issues.slice(0, maxIssues).map((issue) => (
              <li key={issue.id} className="text-xs text-muted-foreground">
                {renderIssueLink ? renderIssueLink(issue, issue.label) : issue.label}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
