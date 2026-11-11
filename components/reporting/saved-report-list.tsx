"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteSavedReportAction, duplicateSavedReportAction } from "@/app/(app)/reporting/saved-reports-actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DATE_RANGE_PRESETS } from "@/lib/reporting/date-range";
import { SAVED_REPORT_PATH_LABEL, type SavedReport } from "@/lib/saved-reports/types";
import { formatRelative } from "@/lib/leads/constants";

function presetLabel(preset: string): string {
  return DATE_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? preset;
}

/**
 * Compact Saved Reports rows — name, category, range, updated, Open / Manage.
 * Replaces oversized LibraryAssetCard stacks for this surface.
 */
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
    if (result.ok) {
      toast.success("Duplicated.");
      router.push(`/reporting/saved/${result.savedReportId}`);
    } else toast.error(result.message ?? "Could not duplicate report.");
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-12 text-center">
        <p className="font-heading text-lg font-medium text-heading">No saved reports yet</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Open any report in Reporting and click &quot;Save Report&quot; to keep a view you come back to often.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2 list-none p-0 m-0" data-testid="saved-report-list">
      {reports.map((r) => {
        const qs = new URLSearchParams({
          range: r.datePreset,
          ...(r.customFrom ? { from: r.customFrom } : {}),
          ...(r.customTo ? { to: r.customTo } : {}),
        }).toString();
        const openHref = `${r.reportPath}?${qs}`;
        return (
          <li
            key={r.id}
            className="flex flex-col gap-2 rounded-md border border-[var(--htc-border-warm)] bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            data-saved-report-row=""
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium text-heading">{r.name}</p>
                <Badge variant="outline" className="text-[10px]">
                  {SAVED_REPORT_PATH_LABEL[r.reportPath]}
                </Badge>
                {r.sourceMasterKey ? (
                  <Badge variant="outline" className="bg-card text-[10px]">
                    Starter
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {presetLabel(r.datePreset)} · Updated {formatRelative(r.updatedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button size="sm" render={<Link href={openHref} />}>
                Open Report
              </Button>
              <Button size="sm" variant="outline" render={<Link href={`/reporting/saved/${r.id}`} />}>
                Manage
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="More actions"
                      disabled={pendingId === r.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDuplicate(r.id, r.name)}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    {LIBRARY_LABELS.duplicate}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => handleDelete(r.id, r.name)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    {LIBRARY_LABELS.delete}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
