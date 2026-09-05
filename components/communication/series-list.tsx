"use client";

/**
 * Automations list — Library row pattern with venue-facing status and audience.
 */

import * as React from "react";

import { Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteSeriesAction, setSeriesStatusAction } from "@/app/(app)/communication/series/actions";
import { LeadLifecycleConfirmDialog } from "@/components/leads/lifecycle-confirm-dialog";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { SEQUENCE_TRIGGER_TYPES } from "@/lib/message-sequences/constants";
import { salesStageLabel } from "@/lib/leads/constants";
import type { MessageSequenceListItem } from "@/lib/message-sequences/types";

function triggerSummary(triggerType: string | null, triggerStage: string | null): string {
  if (!triggerType) return "Starts when you add someone";
  const typeLabel = SEQUENCE_TRIGGER_TYPES.find((t) => t.value === triggerType)?.label ?? triggerType;
  if (triggerType === "lead_stage_changed" && triggerStage) {
    return `Starts when a lead reaches ${salesStageLabel(triggerStage)}`;
  }
  return `Starts when ${typeLabel.charAt(0).toLowerCase()}${typeLabel.slice(1)}`;
}

function participantLabel(count: number): string {
  if (count <= 0) return "No one active right now";
  if (count === 1) return "1 person active";
  return `${count} people active`;
}

const PAUSE_DESCRIPTION =
  "New people won’t enter this automation, and people already in it won’t receive scheduled messages until you resume it. This does not delete anyone or their past messages.";

export function SeriesList({ initialSeries }: { initialSeries: MessageSequenceListItem[] }) {
  const [series, setSeries] = React.useState(initialSeries);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<MessageSequenceListItem | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [pausing, setPausing] = React.useState<MessageSequenceListItem | null>(null);

  async function applyStatus(s: MessageSequenceListItem, next: "active" | "paused") {
    setPendingId(s.id);
    const result = await setSeriesStatusAction(s.id, next);
    setPendingId(null);
    if (result.ok) {
      setSeries((p) => p.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
      toast.success(
        next === "active"
          ? "Automation resumed — new people can join and scheduled messages can send again."
          : "Automation paused for everyone.",
      );
      setPausing(null);
    } else {
      toast.error(result.message ?? "Could not update automation.");
    }
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
          meta={`${triggerSummary(s.triggerType, s.triggerStage)} · ${participantLabel(s.activeParticipantCount)}`}
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
              label: s.status === "active" ? "Pause automation" : "Resume automation",
              onClick: () => {
                if (s.status === "active") setPausing(s);
                else void applyStatus(s, "active");
              },
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
        consequenceNote="Anyone currently in this automation stops receiving further messages from it. Past messages and conversations stay."
        pending={deletePending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleting(null)}
      />
      <LeadLifecycleConfirmDialog
        open={!!pausing}
        title="Pause this automation?"
        description={PAUSE_DESCRIPTION}
        confirmLabel="Pause automation"
        confirming={pendingId === pausing?.id}
        onConfirm={() => { if (pausing) void applyStatus(pausing, "paused"); }}
        onCancel={() => { if (pendingId !== pausing?.id) setPausing(null); }}
      />
    </div>
  );
}
