import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

import { DataTable, Panel } from "@/components/shared/ui";
import {
  subjectBlurb,
  type LegalComplianceSubject,
} from "@/lib/legal/compliance-summary";
import type {
  LegalComplianceRow,
  LegalComplianceStatus,
  LegalComplianceSummary,
} from "@/lib/legal/product-legal";
import { formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<LegalComplianceStatus, string> = {
  current: "Current",
  outdated: "Outdated",
  not_accepted: "Not Accepted",
};

function StatusCell({ status }: { status: LegalComplianceStatus }) {
  const label = STATUS_LABELS[status];
  if (status === "current") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--heritage-sage)]">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        {label}
      </span>
    );
  }
  if (status === "outdated") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

function displayVersion(value: string | null): string {
  return value?.trim() ? value : "—";
}

export function LegalComplianceCard({
  summary,
  historyHref,
}: {
  summary: LegalComplianceSummary | null;
  /** Deep-link to Business → Legal acceptance history for this relationship. */
  historyHref: string | null;
}) {
  const subject: LegalComplianceSubject = summary?.subject ?? "venue";
  const viewHistory =
    historyHref ? (
      <a
        href={historyHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
      >
        View History
      </a>
    ) : null;

  if (!summary || summary.rows.length === 0) {
    return (
      <Panel title="Legal" action={viewHistory}>
        <p className="text-sm ws-muted">
          Legal acceptance status is unavailable. Product sync API may be
          unconfigured, or no applicable documents were found.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Legal" action={viewHistory}>
      <p className="mb-4 text-sm ws-muted">{subjectBlurb(subject)}</p>
      <DataTable
        headers={[
          "Document Name",
          "Accepted Version",
          "Current Version",
          "Acceptance Date",
          "Status",
        ]}
        rows={summary.rows.map((row: LegalComplianceRow) => [
          <span key={`${row.documentType}-doc`} className="font-medium">
            {row.title}
          </span>,
          displayVersion(row.acceptedVersion),
          displayVersion(row.activeVersion),
          row.acceptedAt ? formatDate(row.acceptedAt) : "—",
          <StatusCell key={`${row.documentType}-status`} status={row.status} />,
        ])}
      />
    </Panel>
  );
}
