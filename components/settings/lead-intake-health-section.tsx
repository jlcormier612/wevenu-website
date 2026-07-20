import { AlertCircle, CheckCircle2 } from "lucide-react";

import type { IntakeHealthSummary } from "@/lib/lead-intake/monitoring";
import { sourceLabel } from "@/lib/leads/constants";

const STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  rejected_rate_limited: "Rate limited",
  rejected_invalid: "Invalid",
  rejected_duplicate_batch: "Duplicate (import)",
  error: "Error",
};

export function LeadIntakeHealthSection({ summary }: { summary: IntakeHealthSummary }) {
  if (summary.totalLast7Days === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No inquiries in the last 7 days yet — this will fill in once your form, tour scheduler, or email intake receives one.
      </p>
    );
  }

  const rejected = summary.totalLast7Days - summary.acceptedLast7Days;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Last 7 days</p>
          <p className="text-xl font-semibold text-heading">{summary.totalLast7Days}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Accepted</p>
          <p className="text-xl font-semibold text-heading">{summary.acceptedLast7Days}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Rejected</p>
          <p className="text-xl font-semibold text-heading">{rejected}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Errors</p>
          <p className="text-xl font-semibold text-heading">{summary.errored}</p>
        </div>
      </div>

      {summary.recentAttempts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent activity</p>
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {summary.recentAttempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {a.status === "accepted"
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    : <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="truncate">{sourceLabel(a.source)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  <span>{STATUS_LABEL[a.status] ?? a.status}</span>
                  <span>{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
