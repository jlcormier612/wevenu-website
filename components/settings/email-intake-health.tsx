import type { EmailIntakeHealthView } from "@/lib/lead-intake/email-intake-health";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Compact status for messages Hello to Cheers actually received at this
 * venue's intake address. Does not claim marketplace delivery monitoring.
 */
export function EmailIntakeHealth({ health }: { health: EmailIntakeHealthView }) {
  const issueCount = health.issues.length;

  return (
    <div className="space-y-2 border-t border-border pt-3" data-testid="email-intake-health">
      <p className="text-xs font-medium text-heading">Intake activity</p>
      {issueCount === 0 ? (
        <p className="text-xs text-muted-foreground">
          {health.hasActivity
            ? "No intake issues are recorded."
            : "No intake issues are recorded yet."}{" "}
          This lists only messages Hello to Cheers received at your intake address. It does not
          confirm that a marketplace sent an inquiry, or that every inquiry arrived.
        </p>
      ) : (
        <p className="text-xs text-foreground">
          {issueCount === 1
            ? "1 recorded message needs attention."
            : `${issueCount} recorded messages need attention.`}
          {health.latestIssueAt ? ` Most recent: ${formatWhen(health.latestIssueAt)}.` : null}
        </p>
      )}
      {health.latestSuccessAt ? (
        <p className="text-xs text-muted-foreground">
          Latest message that became a lead: {formatWhen(health.latestSuccessAt)}.
        </p>
      ) : null}
      {issueCount > 0 ? (
        <ul className="space-y-2">
          {health.issues.map((issue) => (
            <li key={issue.id} className="rounded-md border border-border bg-background px-3 py-2">
              <p className="text-xs font-medium text-heading">{issue.statusLabel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatWhen(issue.occurredAt)}</p>
              <p className="mt-1 text-xs text-foreground">{issue.detail}</p>
              {issue.reference ? (
                <p className="mt-1 text-[11px] text-muted-foreground">Reference {issue.reference}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
