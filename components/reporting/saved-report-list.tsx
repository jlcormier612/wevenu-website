"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteSavedReportAction, duplicateSavedReportAction } from "@/app/(app)/reporting/saved-reports-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DATE_RANGE_PRESETS } from "@/lib/reporting/date-range";
import { SAVED_REPORT_PATH_LABEL, type SavedReport } from "@/lib/saved-reports/types";
import { formatRelative } from "@/lib/leads/constants";

function presetLabel(preset: string): string {
  return DATE_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? preset;
}

export function SavedReportList({ reports }: { reports: SavedReport[] }) {
  const router = useRouter();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    setRemovingId(id);
    const result = await deleteSavedReportAction(id);
    setRemovingId(null);
    if (!result.ok) toast.error(result.message ?? "Could not delete report.");
  }

  async function handleDuplicate(id: string, name: string) {
    setDuplicatingId(id);
    const result = await duplicateSavedReportAction(id, `${name} (Copy)`);
    setDuplicatingId(null);
    if (result.ok) { toast.success("Duplicated."); router.push(`/reporting/saved/${result.savedReportId}`); }
    else toast.error(result.message ?? "Could not duplicate report.");
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
        <p className="font-heading text-lg font-medium text-heading">No saved reports yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Open any report in Reporting and click "Save Report" to keep a view you come back to often.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((r) => {
        const qs = new URLSearchParams({ range: r.datePreset, ...(r.customFrom ? { from: r.customFrom } : {}), ...(r.customTo ? { to: r.customTo } : {}) }).toString();
        return (
          <Card key={r.id}>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <Link href={`${r.reportPath}?${qs}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-heading">{r.name}</p>
                  <Badge variant="outline">{SAVED_REPORT_PATH_LABEL[r.reportPath]}</Badge>
                  {r.sourceMasterKey && <Badge variant="muted">Starter</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{presetLabel(r.datePreset)} · Updated {formatRelative(r.updatedAt)}</p>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/reporting/saved/${r.id}`} className="text-xs text-muted-foreground hover:text-foreground underline">Manage</Link>
                <button type="button" onClick={() => handleDuplicate(r.id, r.name)} disabled={duplicatingId === r.id}
                  className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" aria-label="Duplicate saved report">
                  {duplicatingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => handleDelete(r.id, r.name)} disabled={removingId === r.id}
                  className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Delete saved report">
                  {removingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
