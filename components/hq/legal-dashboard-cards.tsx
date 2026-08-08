import { StatTile, StatTileGrid } from "@/components/dashboard-system/stat-tile";
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

// Dashboard Component System, Phase 2 — shell migrated to StatTile
// ("label-top" layout, matching this file's original plain-div rounded-xl
// border p-4 tile exactly); copy and values unchanged.
export function LegalDashboardCards({
  summary,
}: {
  summary: LegalAdminDashboardSummary;
}) {
  return (
    <StatTileGrid className="lg:grid-cols-4">
      {CARDS.map((card) => (
        <StatTile
          key={card.key}
          layout="label-top"
          label={card.label}
          value={card.format(summary)}
          className="rounded-xl border bg-card p-4"
        />
      ))}
    </StatTileGrid>
  );
}
