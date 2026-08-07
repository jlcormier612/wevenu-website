import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

import { DataTable, Panel } from "@/components/shared/ui";
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

function versionLabel(row: LegalComplianceRow): string {
  if (row.acceptedVersion) return row.acceptedVersion;
  if (row.activeVersion) return `— (active ${row.activeVersion})`;
  return "—";
}

export function LegalComplianceCard({
  summary,
}: {
  summary: LegalComplianceSummary | null;
}) {
  if (!summary || summary.rows.length === 0) {
    return (
      <Panel title="Legal">
        <p className="text-sm ws-muted">
          Legal acceptance status is unavailable. Product sync API may be
          unconfigured, or no applicable documents were found.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Legal">
      <p className="mb-4 text-sm ws-muted">
        Read-only compliance for this venue account (Venue Terms + Privacy).
      </p>
      <DataTable
        headers={["Document", "Version", "Acceptance Date", "Current Status"]}
        rows={summary.rows.map((row) => [
          <span key={`${row.documentType}-doc`} className="font-medium">
            {row.title}
          </span>,
          versionLabel(row),
          row.acceptedAt ? formatDate(row.acceptedAt) : "—",
          <StatusCell key={`${row.documentType}-status`} status={row.status} />,
        ])}
      />
    </Panel>
  );
}
