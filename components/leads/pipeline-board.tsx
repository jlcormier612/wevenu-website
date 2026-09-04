"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  updateLeadPipelineStageAction,
  wouldEnrollOnPipelineStageMoveAction,
} from "@/app/(app)/leads/[id]/actions";
import { PipelineAutomationConfirmDialog } from "@/components/leads/pipeline-automation-confirm";
import { eventTypeLabel, formatCurrency, formatDate, leadDisplayName } from "@/lib/leads/constants";
import { SALES_STAGE_META, type SalesStage } from "@/lib/leads/sales-stages";
import type { Lead } from "@/lib/leads/types";
import type { AutomationMessagePreview } from "@/lib/message-sequences/confirm-preview";

/**
 * Fixed seven-column Sales Pipeline board.
 * Stage keys are authoritative sales_stage values — not pipeline_templates stage ids.
 */
export function PipelineBoard({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const stages = SALES_STAGE_META;

  const [overrides, setOverrides] = React.useState<Record<string, SalesStage>>({});
  const [pendingLeadIds, setPendingLeadIds] = React.useState<Set<string>>(new Set());
  const [draggingLeadId, setDraggingLeadId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<SalesStage | null>(null);
  const [confirmMove, setConfirmMove] = React.useState<{
    leadId: string;
    targetStage: SalesStage;
    preview: AutomationMessagePreview | null;
  } | null>(null);

  const { columns, currentStageByLead } = React.useMemo(() => {
    const cols = new Map<SalesStage, Lead[]>();
    stages.forEach((s) => cols.set(s.value, []));
    const currentByLead: Record<string, SalesStage> = {};
    for (const lead of leads) {
      const stage = (overrides[lead.id] ?? lead.salesStage ?? lead.status) as SalesStage;
      if (cols.has(stage)) {
        cols.get(stage)!.push(lead);
        currentByLead[lead.id] = stage;
      }
    }
    return { columns: cols, currentStageByLead: currentByLead };
  }, [leads, overrides, stages]);

  function commitMove(leadId: string, targetStage: SalesStage) {
    setOverrides((p) => ({ ...p, [leadId]: targetStage }));
    setPendingLeadIds((p) => new Set(p).add(leadId));

    updateLeadPipelineStageAction(leadId, targetStage).then((result) => {
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

  function handleDrop(targetStage: SalesStage) {
    const leadId = draggingLeadId;
    setDraggingLeadId(null);
    setDragOverStage(null);
    if (!leadId) return;
    if (currentStageByLead[leadId] === targetStage) return;
    if (targetStage === "booked") {
      toast.error("Booked is only set by converting the lead with Book This Lead.");
      return;
    }

    setPendingLeadIds((p) => new Set(p).add(leadId));
    wouldEnrollOnPipelineStageMoveAction(leadId, targetStage).then((check) => {
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
        setConfirmMove({ leadId, targetStage, preview: check.preview });
        return;
      }
      commitMove(leadId, targetStage);
    });
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const stageLeads = columns.get(stage.value) ?? [];
          const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimatedBudget ?? 0), 0);
          const isDragTarget = dragOverStage === stage.value;
          return (
            <div
              key={stage.value}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.value);
              }}
              onDragLeave={() => setDragOverStage((p) => (p === stage.value ? null : p))}
              onDrop={() => handleDrop(stage.value)}
              className={`flex w-72 shrink-0 flex-col rounded-sm border transition-colors ${isDragTarget ? "border-primary bg-primary/5" : "border-border bg-card/40"}`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-heading">{stage.label}</p>
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
          const { leadId, targetStage } = confirmMove;
          setConfirmMove(null);
          commitMove(leadId, targetStage);
        }}
      />
    </>
  );
}
