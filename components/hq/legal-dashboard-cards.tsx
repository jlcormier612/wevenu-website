import type { LegalAdminDashboardSummary } from "@/lib/legal/admin-helpers";

const CARDS: {
  key: keyof LegalAdminDashboardSummary;
  label: string;
  format: (summary: LegalAdminDashboardSummary) => string;
}[] = [
  {
    key: "currentLegalDocuments",
    label: "Current Legal Documents",
    format: (s) => String(s.currentLegalDocuments),
  },
  {
    key: "totalDocumentVersions",
    label: "Total Document Versions",
    format: (s) => String(s.totalDocumentVersions),
  },
  {
    key: "outstandingAcceptances",
    label: "Outstanding Acceptances",
    format: (s) => String(s.outstandingAcceptances),
  },
  {
    key: "acceptanceRatePercent",
    label: "Acceptance Rate",
    format: (s) =>
      s.acceptanceRatePercent == null
        ? "—"
        : `${s.acceptanceRatePercent}%`,
  },
];

export function LegalDashboardCards({
  summary,
}: {
  summary: LegalAdminDashboardSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="rounded-xl border bg-card p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-1 font-heading text-2xl font-bold text-heading">
            {card.format(summary)}
          </p>
        </div>
      ))}
    </div>
  );
}
