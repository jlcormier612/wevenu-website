"use client";

/**
 * Automations list — brought onto the canonical Library row/card pattern
 * (Template UX Consistency). Automations have no distinct preview or "use"
 * concept: editing the steps is the only way to see what an Automation
 * does, and it's already live/configured the moment it exists — there is
 * nothing to separately "apply." Pause/Resume and Delete were already real,
 * wired server actions with no venue-facing surface before this; nothing
 * about their behavior changes here, only where they're reachable.
 */

import * as React from "react";

import { Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteSeriesAction, setSeriesStatusAction } from "@/app/(app)/communication/series/actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { SEQUENCE_TRIGGER_TYPES } from "@/lib/message-sequences/constants";
import { salesStageLabel } from "@/lib/leads/constants";
import type { MessageSequence } from "@/lib/message-sequences/types";

function triggerSummary(triggerType: string | null, triggerStage: string | null): string {
  if (!triggerType) return "Manual only";
  const typeLabel = SEQUENCE_TRIGGER_TYPES.find((t) => t.value === triggerType)?.label ?? triggerType;
  if (triggerType === "lead_stage_changed" && triggerStage) {
    return `${typeLabel} · ${salesStageLabel(triggerStage)}`;
  }
  return typeLabel;
}

export function SeriesList({ initialSeries }: { initialSeries: MessageSequence[] }) {
  const [series, setSeries] = React.useState(initialSeries);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<MessageSequence | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  async function handleToggleStatus(s: MessageSequence) {
    setPendingId(s.id);
    const next = s.status === "active" ? "paused" : "active";
    const result = await setSeriesStatusAction(s.id, next);
    setPendingId(null);
    if (result.ok) {
      setSeries((p) => p.map((x) => x.id === s.id ? { ...x, status: next } : x));
      toast.success(next === "active" ? "Automation resumed." : "Automation paused.");
    } else toast.error(result.message ?? "Could not update automation.");
  }

  async function handleDeleteConfirmed() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deleteSeriesAction(deleting.id);
    setDeletePending(false);
    if (result.ok) {
      setSeries((p) => p.filter((x) => x.id !== deleting.id));
      toast.success("Automation deleted.");
      setDeleting(null);
    } else toast.error(result.message ?? "Could not delete automation.");
  }

  return (
    <div className="space-y-2">
      {series.map((s) => (
        <LibraryAssetCard
          key={s.id}
          layout="row"
          title={s.name}
          meta={triggerSummary(s.triggerType, s.triggerStage)}
          badges={
            <Badge variant={s.status === "active" ? "success" : "muted"} className="text-[10px]">
              {s.status === "active" ? "Active" : "Paused"}
            </Badge>
          }
          primaryActions={[
            { id: "edit", label: LIBRARY_LABELS.edit, href: `/communication/series/${s.id}/edit`, emphasis: "edit" },
          ]}
          overflowPending={pendingId === s.id}
          overflowItems={[
            {
              id: "toggle",
              label: s.status === "active" ? "Pause" : "Resume",
              onClick: () => handleToggleStatus(s),
              icon: s.status === "active" ? <Pause className="mr-2 h-3.5 w-3.5" /> : <Play className="mr-2 h-3.5 w-3.5" />,
            },
            {
              id: "delete",
              label: LIBRARY_LABELS.delete,
              onClick: () => setDeleting(s),
              destructive: true,
              separatorBefore: true,
              icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
            },
          ]}
        />
      ))}
      <LibraryDeleteConfirmDialog
        open={!!deleting}
        itemName={deleting?.name ?? ""}
        itemLabel="automation"
        consequenceNote="Anyone currently enrolled stops receiving further steps from this automation."
        pending={deletePending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
