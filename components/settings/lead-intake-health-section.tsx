import Link from "next/link";

import type { LeadCaptureSummary } from "@/lib/lead-intake/monitoring";

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Venue-facing Lead Capture summary.
 * Answers: Are inquiries arriving? Where from? Do I need to do something?
 * Does not expose rejected/error/confidence telemetry.
 */
export function LeadIntakeHealthSection({ summary }: { summary: LeadCaptureSummary }) {
  const received = summary.receivedLast7Days;
  const needsReview = summary.needsReview ?? [];
  const sources = summary.sourceBreakdown ?? [];
  const recent = summary.recentInquiries ?? [];

  if (received === 0 && needsReview.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-heading font-medium">No inquiries in the last 7 days yet.</p>
        <p className="text-sm text-muted-foreground">
          Once couples reach you through your website, tours, email intake, or other sources,
          they&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-semibold text-heading">
          {received === 1
            ? "1 inquiry received in the last 7 days"
            : `${received} inquiries received in the last 7 days`}
        </p>
        {needsReview.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            All caught up. Your inquiries are being captured normally.
          </p>
        ) : null}
      </div>

      {sources.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-heading">Where your inquiries come from</p>
          <ul className="space-y-1.5">
            {sources.map((s) => (
              <li
                key={s.source}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-foreground">{s.label}</span>
                <span className="font-medium text-heading tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {needsReview.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-sm font-medium text-heading">Needs your attention</p>
          <p className="text-sm text-muted-foreground">
            {needsReview.length === 1
              ? "1 inquiry needs review before automated follow-up."
              : `${needsReview.length} inquiries need review before automated follow-up.`}
          </p>
          <ul className="space-y-1.5">
            {needsReview.slice(0, 5).map((item) => (
              <li key={item.leadId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-foreground">{item.displayName}</span>
                <Link
                  href={`/leads/${item.leadId}`}
                  className="shrink-0 text-primary hover:underline"
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-heading">Recent inquiries</p>
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {recent.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-foreground">{a.sourceLabel}</span>
                  <span className="text-xs text-muted-foreground">Received</span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatShortDate(a.createdAt)}</span>
                  {a.leadId ? (
                    <Link href={`/leads/${a.leadId}`} className="text-primary hover:underline">
                      Open
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
