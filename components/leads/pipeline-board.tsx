"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateLeadPipelineStageAction } from "@/app/(app)/leads/[id]/actions";
import { eventTypeLabel, formatCurrency, formatDate, leadDisplayName } from "@/lib/leads/constants";
import { resolvePipelineStageForLead } from "@/lib/leads/pipeline-stage-mapping";
import type { Lead } from "@/lib/leads/types";
import type { PipelineStage } from "@/lib/pipeline-templates/types";

/**
 * Drag-and-drop reuses the same native HTML5 primitives as the Pipeline
 * Template stage editor (components/settings/pipeline-template-form.tsx) —
 * no new dependency. Moving a card calls the existing
 * updateLeadPipelineStageAction, unchanged from Phase 2: it maps the
 * target stage's canonical value to a real leads.status and writes through
 * the untouched updateLeadStatus(), so every existing side effect (activity
 * log, Automated Series, scoring) keeps firing exactly as it already does.
 */
export function PipelineBoard({
  leads, stages, stageIdsByLead,
}: {
  leads: Lead[];
  stages: PipelineStage[];
  stageIdsByLead: Record<string, string | null>;
}) {
  const router = useRouter();
  const orderedStages = React.useMemo(() => [...stages].sort((a, b) => a.sortOrder - b.sortOrder), [stages]);

  // Optimistic local override of a lead's stage, applied immediately on
  // drop and reconciled (or reverted on failure) once the server responds.
  const [overrides, setOverrides] = React.useState<Record<string, string>>({});
  const [pendingLeadIds, setPendingLeadIds] = React.useState<Set<string>>(new Set());
  const [draggingLeadId, setDraggingLeadId] = React.useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = React.useState<string | null>(null);

  const { columns, currentStageIdByLead } = React.useMemo(() => {
    const cols = new Map<string, Lead[]>();
    orderedStages.forEach((s) => cols.set(s.id, []));
    const currentByLead: Record<string, string | undefined> = {};
    for (const lead of leads) {
      const explicit = overrides[lead.id] ?? stageIdsByLead[lead.id] ?? null;
      const stage = resolvePipelineStageForLead(lead.status, explicit, orderedStages);
      if (stage) {
        cols.get(stage.id)?.push(lead);
        currentByLead[lead.id] = stage.id;
      }
    }
    return { columns: cols, currentStageIdByLead: currentByLead };
  }, [leads, orderedStages, overrides, stageIdsByLead]);

  function handleDrop(targetStageId: string) {
    const leadId = draggingLeadId;
    setDraggingLeadId(null);
    setDragOverStageId(null);
    if (!leadId) return;
    if (currentStageIdByLead[leadId] === targetStageId) return; // dropped back in the same column

    setOverrides((p) => ({ ...p, [leadId]: targetStageId }));
    setPendingLeadIds((p) => new Set(p).add(leadId));

    updateLeadPipelineStageAction(leadId, targetStageId).then((result) => {
      setPendingLeadIds((p) => { const n = new Set(p); n.delete(leadId); return n; });
      if (!result.ok) {
        toast.error(result.message ?? "Could not move this lead.");
        setOverrides((p) => { const n = { ...p }; delete n[leadId]; return n; });
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {orderedStages.map((stage) => {
        const stageLeads = columns.get(stage.id) ?? [];
        const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimatedBudget ?? 0), 0);
        const isDragTarget = dragOverStageId === stage.id;
        return (
          <div
            key={stage.id}
            onDragOver={(e) => { e.preventDefault(); setDragOverStageId(stage.id); }}
            onDragLeave={() => setDragOverStageId((p) => (p === stage.id ? null : p))}
            onDrop={() => handleDrop(stage.id)}
            className={`flex w-72 shrink-0 flex-col rounded-xl border transition-colors ${isDragTarget ? "border-primary bg-primary/5" : "border-border bg-card/40"}`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                <p className="truncate text-sm font-semibold text-heading">{stage.name}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {stageLeads.length}
              </span>
            </div>
            <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">{formatCurrency(stageValue)}</p>

            <div className="min-h-24 flex-1 space-y-2 p-2.5">
              {stageLeads.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No leads</p>
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
                  onKeyDown={(e) => { if (e.key === "Enter") router.push(`/leads/${lead.id}`); }}
                  className={`cursor-grab rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm transition-colors hover:border-primary/40 ${pendingLeadIds.has(lead.id) ? "opacity-50" : ""}`}
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {lead.eventType && <span>{eventTypeLabel(lead.eventType)}</span>}
                    {lead.eventDate && <span>{formatDate(lead.eventDate)}</span>}
                  </div>
                  {lead.estimatedBudget != null && (
                    <p className="mt-1 text-xs font-medium text-foreground">{formatCurrency(lead.estimatedBudget)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
