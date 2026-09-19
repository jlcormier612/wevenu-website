"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  confirmPipelineBookedMoveAction,
  markLeadLostAction,
  updateLeadPipelineStageAction,
  wouldEnrollOnPipelineStageMoveAction,
} from "@/app/(app)/leads/[id]/actions";
import { LostReasonDialog } from "@/components/leads/lost-reason-dialog";
import { PipelineAutomationConfirmDialog } from "@/components/leads/pipeline-automation-confirm";
import { PipelineBookedConfirmDialog } from "@/components/leads/pipeline-booked-confirm-dialog";
import { eventTypeLabel, formatCurrency, formatDate, leadDisplayName } from "@/lib/leads/constants";
import type { LostReasonValue } from "@/lib/leads/lost-reasons";
import { resolveTransitionKind } from "@/lib/leads/pipeline-stage-transition";
import { SALES_STAGE_META, type SalesStage } from "@/lib/leads/sales-stages";
import type { Lead } from "@/lib/leads/types";
import type { AutomationMessagePreview } from "@/lib/message-sequences/confirm-preview";
import { salesStageForCanonical } from "@/lib/pipeline-templates/sales-stage-bridge";
import { resolveVenuePipelineStageId } from "@/lib/pipeline-templates/resolve-lead-stage";
import type { PipelineStage } from "@/lib/pipeline-templates/types";

type BoardColumn = {
  key: string;
  label: string;
  /** sales_stage key used for Booked / Lost guards when on fixed board */
  salesStage: SalesStage;
  color?: string;
};

function fixedColumns(): BoardColumn[] {
  return SALES_STAGE_META.map((s) => ({
    key: s.value,
    label: s.label,
    salesStage: s.value,
  }));
}

function venueColumns(stages: PipelineStage[]): BoardColumn[] {
  return stages.map((s) => ({
    key: s.id,
    label: s.name,
    salesStage: salesStageForCanonical(s.canonicalStage),
    color: s.color,
  }));
}

/**
 * Pipeline board — venue-defined stages when an active Pipeline Template
 * exists; otherwise the fixed seven-stage Sales Pipeline.
 */
export function PipelineBoard({
  leads,
  venueStages = null,
}: {
  leads: Lead[];
  venueStages?: PipelineStage[] | null;
}) {
  const router = useRouter();
  const usingVenue = (venueStages?.length ?? 0) > 0;
  const columnsMeta = usingVenue ? venueColumns(venueStages!) : fixedColumns();

  const [overrides, setOverrides] = React.useState<Record<string, string>>({});
  const [pendingLeadIds, setPendingLeadIds] = React.useState<Set<string>>(new Set());
  const [draggingLeadId, setDraggingLeadId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<string | null>(null);
  const [confirmMove, setConfirmMove] = React.useState<{
    leadId: string;
    targetKey: string;
    preview: AutomationMessagePreview | null;
  } | null>(null);
  const [lostMove, setLostMove] = React.useState<{ leadId: string; targetKey: string; label: string } | null>(null);
  const [bookedMove, setBookedMove] = React.useState<{ leadId: string; targetKey: string; label: string } | null>(null);
  const [lifecyclePending, setLifecyclePending] = React.useState(false);

  const { columns, currentKeyByLead } = React.useMemo(() => {
    const currentByLead: Record<string, string> = {};
    if (usingVenue && venueStages) {
      const cols = new Map<string, Lead[]>();
      for (const stage of venueStages) cols.set(stage.id, []);
      for (const lead of leads) {
        const key = overrides[lead.id]
          ?? resolveVenuePipelineStageId(venueStages, {
            pipelineStageId: lead.pipelineStageId,
            salesStage: lead.salesStage ?? lead.status,
          });
        if (key) {
          currentByLead[lead.id] = key;
          if (cols.has(key)) cols.get(key)!.push(lead);
        }
      }
      return { columns: cols, currentKeyByLead: currentByLead };
    }

    const cols = new Map<string, Lead[]>();
    for (const s of SALES_STAGE_META) cols.set(s.value, []);
    for (const lead of leads) {
      const stage = (overrides[lead.id] ?? lead.salesStage ?? lead.status) as SalesStage;
      if (cols.has(stage)) {
        cols.get(stage)!.push(lead);
        currentByLead[lead.id] = stage;
      }
    }
    return { columns: cols, currentKeyByLead: currentByLead };
  }, [leads, overrides, usingVenue, venueStages]);

  function commitMove(leadId: string, targetKey: string) {
    setOverrides((p) => ({ ...p, [leadId]: targetKey }));
    setPendingLeadIds((p) => new Set(p).add(leadId));

    updateLeadPipelineStageAction(leadId, targetKey).then((result) => {
      setPendingLeadIds((p) => {
        const n = new Set(p);
        n.delete(leadId);
        return n;
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not move this lead.");
        setOverrides((p) => {
          const n = { ...p };
          delete n[leadId];
          return n;
        });
      } else {
        router.refresh();
      }
    });
  }

  function handleDrop(targetKey: string) {
    const leadId = draggingLeadId;
    setDraggingLeadId(null);
    setDragOverStage(null);
    if (!leadId) return;
    if (currentKeyByLead[leadId] === targetKey) return;

    const targetMeta = columnsMeta.find((c) => c.key === targetKey);
    const currentMeta = columnsMeta.find((c) => c.key === currentKeyByLead[leadId]);
    if (!targetMeta) return;

    if (currentMeta?.salesStage === "booked" && targetMeta.salesStage !== "lost") {
      toast.error("Open this lead and use Move back to Sales Pipeline.");
      return;
    }

    const kind = resolveTransitionKind({
      targetKey,
      venueStages: usingVenue ? venueStages : null,
    });

    if (kind === "booked") {
      setBookedMove({ leadId, targetKey, label: targetMeta.label });
      return;
    }
    if (kind === "lost") {
      setLostMove({ leadId, targetKey, label: targetMeta.label });
      return;
    }

    setPendingLeadIds((p) => new Set(p).add(leadId));
    wouldEnrollOnPipelineStageMoveAction(leadId, targetKey).then((check) => {
      setPendingLeadIds((p) => {
        const n = new Set(p);
        n.delete(leadId);
        return n;
      });
      if (!check.ok) {
        toast.error(check.message ?? "Could not check this move.");
        return;
      }
      if (check.wouldEnroll) {
        setConfirmMove({ leadId, targetKey, preview: check.preview });
        return;
      }
      commitMove(leadId, targetKey);
    });
  }

  async function confirmLost(input: { reason: LostReasonValue; detail: string | null }) {
    if (!lostMove) return;
    const { leadId, targetKey } = lostMove;
    setLifecyclePending(true);
    const result = await markLeadLostAction(leadId, input, targetKey);
    setLifecyclePending(false);
    if (!result.ok) {
      toast.error(result.message ?? "Could not mark this lead Lost.");
      return;
    }
    setLostMove(null);
    setOverrides((p) => ({ ...p, [leadId]: targetKey }));
    toast.success("Marked as Lost.");
    router.refresh();
  }

  async function confirmBooked() {
    if (!bookedMove) return;
    const { leadId, targetKey } = bookedMove;
    setLifecyclePending(true);
    const result = await confirmPipelineBookedMoveAction(leadId, targetKey);
    setLifecyclePending(false);
    if (!result.ok) {
      toast.error(result.message ?? "Could not move this lead to Booked.");
      return;
    }
    setBookedMove(null);
    if (result.warning) toast.warning(result.warning);
    if ("firstTime" in result && result.firstTime === false) {
      toast.success("Already booked.");
      router.refresh();
      return;
    }
    const qs = new URLSearchParams({ from: "booked" });
    if (result.eventId) qs.set("eventId", result.eventId);
    router.push(`/clients/${result.clientId}/booked?${qs.toString()}`);
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columnsMeta.map((stage) => {
          const stageLeads = columns.get(stage.key) ?? [];
          const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimatedBudget ?? 0), 0);
          const isDragTarget = dragOverStage === stage.key;
          return (
            <div
              key={stage.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.key);
              }}
              onDragLeave={() => setDragOverStage((p) => (p === stage.key ? null : p))}
              onDrop={() => handleDrop(stage.key)}
              className={`flex w-72 shrink-0 flex-col rounded-sm border transition-colors ${isDragTarget ? "border-primary bg-primary/5" : "border-border bg-card/40"}`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  {stage.color && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                      aria-hidden
                    />
                  )}
                  <p className="truncate text-sm font-semibold text-heading">{stage.label}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {stageLeads.length}
                </span>
              </div>
              <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">{formatCurrency(stageValue)}</p>

              <div className="min-h-24 flex-1 space-y-2 p-2.5">
                {stageLeads.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs leading-relaxed text-muted-foreground">
                    No leads in {stage.label} yet. Leads move into this stage as you work through your sales process.
                  </p>
                )}
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    role="link"
                    tabIndex={0}
                    draggable
                    onDragStart={() => setDraggingLeadId(lead.id)}
                    onDragEnd={() => setDraggingLeadId(null)}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/leads/${lead.id}`);
                    }}
                    className={`cursor-grab rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm transition-colors hover:border-primary/40 ${pendingLeadIds.has(lead.id) ? "opacity-50" : ""}`}
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}
                    </p>
                    {lead.eventType && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{eventTypeLabel(lead.eventType)}</p>
                    )}
                    {lead.eventDate && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(lead.eventDate)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <PipelineAutomationConfirmDialog
        open={confirmMove != null}
        preview={confirmMove?.preview ?? null}
        onCancel={() => setConfirmMove(null)}
        onContinue={() => {
          if (!confirmMove) return;
          const { leadId, targetKey } = confirmMove;
          setConfirmMove(null);
          commitMove(leadId, targetKey);
        }}
      />

      <LostReasonDialog
        open={lostMove != null}
        stageLabel={lostMove?.label}
        confirming={lifecyclePending}
        onCancel={() => setLostMove(null)}
        onConfirm={confirmLost}
      />

      <PipelineBookedConfirmDialog
        open={bookedMove != null}
        stageLabel={bookedMove?.label}
        confirming={lifecyclePending}
        onCancel={() => setBookedMove(null)}
        onConfirm={confirmBooked}
      />
    </>
  );
}
