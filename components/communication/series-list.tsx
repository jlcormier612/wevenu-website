"use client";

/**
 * Automations list — Sales / Client / Manual grouping with venue-facing status.
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
import {
  AUTOMATION_AUDIENCE_LABELS,
  SEQUENCE_TRIGGER_TYPES,
} from "@/lib/message-sequences/constants";
import { audienceForTrigger } from "@/lib/message-sequences/platform-triggers";
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

function AutomationRow({
  s,
  pendingId,
  onPauseRequest,
  onResume,
  onDeleteRequest,
}: {
  s: MessageSequenceListItem;
  pendingId: string | null;
  onPauseRequest: (s: MessageSequenceListItem) => void;
  onResume: (s: MessageSequenceListItem) => void;
  onDeleteRequest: (s: MessageSequenceListItem) => void;
}) {
  return (
    <LibraryAssetCard
      key={s.id}
      layout="row"
      title={s.name}
      meta={`${triggerSummary(s.triggerType, s.triggerStage)} · ${participantLabel(s.activeParticipantCount)}${
        s.status === "paused" ? " · Turn on when you’re ready" : ""
      }`}
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
            if (s.status === "active") onPauseRequest(s);
            else onResume(s);
          },
          icon: s.status === "active" ? <Pause className="mr-2 h-3.5 w-3.5" /> : <Play className="mr-2 h-3.5 w-3.5" />,
        },
        {
          id: "delete",
          label: LIBRARY_LABELS.delete,
          onClick: () => onDeleteRequest(s),
          destructive: true,
          separatorBefore: true,
          icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
        },
      ]}
    />
  );
}

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

  const sales = series.filter((s) => audienceForTrigger(s.triggerType) === "sales");
  const client = series.filter((s) => audienceForTrigger(s.triggerType) === "client");
  const manual = series.filter((s) => audienceForTrigger(s.triggerType) === "manual");

  const groups: { key: string; title: string; blurb: string; items: MessageSequenceListItem[] }[] = [
    { key: "sales", title: AUTOMATION_AUDIENCE_LABELS.sales.title, blurb: AUTOMATION_AUDIENCE_LABELS.sales.blurb, items: sales },
    { key: "client", title: AUTOMATION_AUDIENCE_LABELS.client.title, blurb: AUTOMATION_AUDIENCE_LABELS.client.blurb, items: client },
    { key: "manual", title: "Manual", blurb: "You choose who joins.", items: manual },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2" aria-labelledby={`automation-group-${group.key}`}>
          <div>
            <h2 id={`automation-group-${group.key}`} className="text-sm font-semibold text-heading">
              {group.title}
            </h2>
            <p className="text-xs text-muted-foreground">{group.blurb}</p>
          </div>
          <div className="space-y-2">
            {group.items.map((s) => (
              <AutomationRow
                key={s.id}
                s={s}
                pendingId={pendingId}
                onPauseRequest={setPausing}
                onResume={(row) => void applyStatus(row, "active")}
                onDeleteRequest={setDeleting}
              />
            ))}
          </div>
        </section>
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
