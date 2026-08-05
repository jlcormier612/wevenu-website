"use client";

import * as React from "react";

import { CheckCircle2, Clock, FileSignature, MessageSquare, Receipt, Upload as UploadIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { celebrateLuv } from "@/lib/luv/celebrate";
import { formatEventRelativeDue, formatAbsoluteDueDate } from "@/lib/playbooks/due-dates";
import { buildUnifiedTaskList, type UnifiedTask } from "@/lib/portal/unified-tasks";
import type { PortalSection, PortalTask } from "@/lib/portal/types";
import type { PortalRequestSummary } from "@/lib/requests/types";

const KIND_ICON: Record<UnifiedTask["kind"], React.ComponentType<{ className?: string }>> = {
  venue_task: CheckCircle2, request: MessageSquare, contract: FileSignature,
  payment: Receipt, questionnaire: UploadIcon, timeline: Clock,
};

function dueLabel(item: UnifiedTask): string {
  if (item.kind === "venue_task") {
    return formatEventRelativeDue({
      daysOffset: item.daysOffset,
      dueDate: item.dueDate,
      dueDateLocked: item.dueDateLocked,
      style: "urgency",
    });
  }
  if (!item.dueDate) return "";
  return `Due ${formatAbsoluteDueDate(item.dueDate)}`;
}

/**
 * Unified Tasks — the couple's operational home (Client Collaboration
 * Workspace, 2026-07-22). One chronological list synthesized across every
 * venue-assigned system; the couple never has to go find where to
 * complete something — each row's action either completes it in place or
 * jumps straight to the section that owns the real action.
 */
export function UnifiedTasksSection({ token, initialTasks, venueName, onNavigate }: {
  token: string; initialTasks: PortalTask[]; venueName: string;
  onNavigate: (section: PortalSection) => void;
}) {
  const [venueTasks, setVenueTasks] = React.useState(initialTasks);
  const [requests, setRequests] = React.useState<PortalRequestSummary[]>([]);
  const [paymentSchedules, setPaymentSchedules] = React.useState<{ title: string; lineItems: { id: string; label: string; amount: number; dueDate: string | null; status: string }[] }[]>([]);
  const [questionnaire, setQuestionnaire] = React.useState<{ status: string } | null>(null);
  const [documents, setDocuments] = React.useState<{ id: string; docType: string; name: string; status: string | null; signToken?: string | null }[]>([]);
  const [timelineUnpublished, setTimelineUnpublished] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [completing, setCompleting] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [tasksRes, requestsRes, paymentsRes, questionnaireRes, documentsRes, timelineRes] = await Promise.all([
      fetch(`/api/portal/tasks?token=${token}`).then((r) => r.json()).catch(() => ({ tasks: initialTasks })),
      fetch(`/api/portal/requests?token=${token}`).then((r) => r.json()).catch(() => ({ requests: [] })),
      fetch(`/api/portal/payments?token=${token}`).then((r) => r.json()).catch(() => ({ schedules: [] })),
      fetch(`/api/portal/questionnaire?token=${token}`).then((r) => r.json()).catch(() => ({ questionnaire: null })),
      fetch(`/api/portal/documents?token=${token}`).then((r) => r.json()).catch(() => ({ documents: [] })),
      fetch(`/api/portal/timeline?token=${token}`).then((r) => r.json()).catch(() => ({ hasUnpublishedChanges: false })),
    ]);
    setVenueTasks(tasksRes.tasks ?? []);
    setRequests(requestsRes.requests ?? []);
    setPaymentSchedules(paymentsRes.schedules ?? []);
    setQuestionnaire(questionnaireRes.questionnaire ? { status: questionnaireRes.questionnaire.status } : null);
    setDocuments(documentsRes.documents ?? []);
    setTimelineUnpublished(!!timelineRes.hasUnpublishedChanges);
    setLoaded(true);
  }, [token, initialTasks]);

  React.useEffect(() => { void load(); }, [load]);

  async function handleComplete(taskId: string) {
    const rawId = taskId.replace(/^task_/, "");
    setCompleting(taskId);
    const res = await fetch("/api/portal/complete-task", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, taskId: rawId }),
    });
    const data = await res.json() as { ok: boolean };
    setCompleting(null);
    if (data.ok) {
      setVenueTasks((p) => p.map((t) => t.id === rawId ? { ...t, status: "complete" as const, canComplete: false } : t));
      celebrateLuv("Nice work — one less thing to worry about!");
    } else {
      toast.error("Could not complete task.");
    }
  }

  const doneVenueTasks = venueTasks.filter((t) => t.status === "complete").length;
  const totalVenueTasks = venueTasks.length;

  const allItems = buildUnifiedTaskList({
    venueTasks, requests, paymentSchedules, questionnaire, documents,
    timelineHasUnpublishedChanges: timelineUnpublished,
  });

  // Program 4, Initiative C (2026-07-23) — Requests dropped as its own
  // primary nav destination; couples get exactly one destination for work
  // ("the couple should have exactly one destination for work that needs
  // to be completed"), with Venue Requests as a first-class filter inside
  // it rather than a second inbox. Filters the same synthesized list, not
  // a second data source.
  const [filter, setFilter] = React.useState<"all" | "requests">("all");
  const requestCount = allItems.filter((i) => i.kind === "request").length;
  const items = filter === "requests" ? allItems.filter((i) => i.kind === "request") : allItems;

  if (!loaded) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          Everything <span className="font-medium">{venueName}</span> needs from you, in one place — newest due date first.
        </p>
        {totalVenueTasks > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((doneVenueTasks / totalVenueTasks) * 100)}%`, background: "var(--venue-primary)" }} />
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{doneVenueTasks}/{totalVenueTasks} tasks complete</span>
          </div>
        )}
      </div>

      {requestCount > 0 && (
        <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 w-fit">
          {([
            { id: "all" as const, label: "All" },
            { id: "requests" as const, label: `Venue Requests (${requestCount})` },
          ]).map((t) => (
            <button key={t.id} type="button" onClick={() => setFilter(t.id)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
              style={{
                color: filter === t.id ? "var(--venue-primary)" : "#6A6460",
                background: filter === t.id ? "var(--card)" : "transparent",
                fontWeight: filter === t.id ? 600 : 400,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">You&apos;re all caught up</p>
          <p className="text-xs mt-1">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-heading">{item.title}</p>
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                  {(item.dueDate || item.daysOffset != null) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{dueLabel(item)}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={completing === item.id}
                  onClick={() => item.completableHere ? handleComplete(item.id) : onNavigate(item.targetSection)}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--venue-primary)" }}
                >
                  {completing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : item.actionLabel}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
