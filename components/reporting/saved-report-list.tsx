"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteSavedReportAction, duplicateSavedReportAction } from "@/app/(app)/reporting/saved-reports-actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { Badge } from "@/components/ui/badge";
import { DATE_RANGE_PRESETS } from "@/lib/reporting/date-range";
import { SAVED_REPORT_PATH_LABEL, type SavedReport } from "@/lib/saved-reports/types";
import { formatRelative } from "@/lib/leads/constants";

function presetLabel(preset: string): string {
  return DATE_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? preset;
}

export function SavedReportList({ reports }: { reports: SavedReport[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?\n\nThis removes your saved report bookmark only — it does not delete underlying venue data.`)) return;
    setPendingId(id);
    const result = await deleteSavedReportAction(id);
    setPendingId(null);
    if (result.ok) toast.success("Report deleted.");
    else toast.error(result.message ?? "Could not delete report.");
  }

  async function handleDuplicate(id: string, name: string) {
    setPendingId(id);
    const result = await duplicateSavedReportAction(id, `${name} (Copy)`);
    setPendingId(null);
    if (result.ok) { toast.success("Duplicated."); router.push(`/reporting/saved/${result.savedReportId}`); }
    else toast.error(result.message ?? "Could not duplicate report.");
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
        <p className="font-heading text-lg font-medium text-heading">No saved reports yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Open any report in Reporting and click &quot;Save Report&quot; to keep a view you come back to often.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((r) => {
        const qs = new URLSearchParams({ range: r.datePreset, ...(r.customFrom ? { from: r.customFrom } : {}), ...(r.customTo ? { to: r.customTo } : {}) }).toString();
        return (
          <LibraryAssetCard
            key={r.id}
            layout="row"
            title={r.name}
            meta={`${presetLabel(r.datePreset)} · Updated ${formatRelative(r.updatedAt)}`}
            isStarter={Boolean(r.sourceMasterKey)}
            badges={<Badge variant="outline">{SAVED_REPORT_PATH_LABEL[r.reportPath]}</Badge>}
            primaryActions={[
              { id: "use", label: "Open report", href: `${r.reportPath}?${qs}`, emphasis: "use" },
              { id: "edit", label: "Manage", href: `/reporting/saved/${r.id}`, emphasis: "edit" },
            ]}
            overflowPending={pendingId === r.id}
            overflowItems={[
              {
                id: "duplicate",
                label: LIBRARY_LABELS.duplicate,
                onClick: () => handleDuplicate(r.id, r.name),
                icon: <Copy className="mr-2 h-3.5 w-3.5" />,
              },
              {
                id: "delete",
                label: LIBRARY_LABELS.delete,
                onClick: () => handleDelete(r.id, r.name),
                destructive: true,
                separatorBefore: true,
                icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
              },
            ]}
          />
        );
      })}
    </div>
  );
}
