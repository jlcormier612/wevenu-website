"use client";

import * as React from "react";

import {
  CheckCircle2, CheckSquare, Circle, Clock, ExternalLink, FileSignature, MessageSquare,
  Paperclip, Receipt, Upload as UploadIcon, Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { LinkifiedText } from "@/components/shared/linkified-text";
import { formatEventRelativeDue, formatAbsoluteDueDate } from "@/lib/playbooks/due-dates";
import { celebrateTaskComplete } from "@/lib/portal/celebrate-task";
import {
  SHARE_TIMELINE_ACTION_TYPE,
  shareTimelineWorkspace,
} from "@/lib/portal/couple-share-timeline";
import {
  buildUnifiedTaskList,
  unifiedTaskCompletionCounts,
  type UnifiedTask,
} from "@/lib/portal/unified-tasks";
import type { PortalWorkspaceFocus } from "@/lib/portal/workspace-routing";
import { partitionByCompletion } from "@/lib/tasks/group-by-completion";
import { vendorConfirmCouplePhase } from "@/lib/vendor-tasks/vendor-confirm-state";
import type { PortalSection, PortalTask, PortalVendorTask } from "@/lib/portal/types";
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
 * Couple Tasks — two stacked bands (not mixed):
 *   1. From your venue — existing Unified Tasks synthesis
 *   2. From your vendors — projected vendor_tasks shared via couple_visibility
 */
export function UnifiedTasksSection({
  token, initialTasks, initialVendorTasks = [], initialTimelineHasUnpublishedChanges = false, venueName, onNavigate,
}: {
  token: string;
  initialTasks: PortalTask[];
  initialVendorTasks?: PortalVendorTask[];
  initialTimelineHasUnpublishedChanges?: boolean;
  venueName: string;
  onNavigate: (section: PortalSection, focus?: PortalWorkspaceFocus | null) => void;
}) {
  const [venueTasks, setVenueTasks] = React.useState(initialTasks);
  const [vendorTasks, setVendorTasks] = React.useState(initialVendorTasks);
  const [requests, setRequests] = React.useState<PortalRequestSummary[]>([]);
  const [paymentSchedules, setPaymentSchedules] = React.useState<{ title: string; lineItems: { id: string; label: string; amount: number; dueDate: string | null; status: string }[] }[]>([]);
  const [questionnaire, setQuestionnaire] = React.useState<{ status: string } | null>(null);
  const [documents, setDocuments] = React.useState<{ id: string; docType: string; name: string; status: string | null; signToken?: string | null }[]>([]);
  const [timelineUnpublished, setTimelineUnpublished] = React.useState(initialTimelineHasUnpublishedChanges);
  const [loaded, setLoaded] = React.useState(false);
  const [completing, setCompleting] = React.useState<string | null>(null);
  const [undoing, setUndoing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [tasksRes, requestsRes, paymentsRes, questionnaireRes, documentsRes, timelineRes] = await Promise.all([
      fetch(`/api/portal/tasks?token=${token}`).then((r) => r.json()).catch(() => ({
        tasks: initialTasks,
        vendorTasks: initialVendorTasks,
      })),
      fetch(`/api/portal/requests?token=${token}`).then((r) => r.json()).catch(() => ({ requests: [] })),
      fetch(`/api/portal/payments?token=${token}`).then((r) => r.json()).catch(() => ({ schedules: [] })),
      fetch(`/api/portal/questionnaire?token=${token}`).then((r) => r.json()).catch(() => ({ questionnaire: null })),
      fetch(`/api/portal/documents?token=${token}`).then((r) => r.json()).catch(() => ({ documents: [] })),
      fetch(`/api/portal/timeline?token=${token}`).then((r) => r.json()).catch(() => ({
        hasUnpublishedChanges: initialTimelineHasUnpublishedChanges,
      })),
    ]);
    setVenueTasks(tasksRes.tasks ?? []);
    setVendorTasks(tasksRes.vendorTasks ?? []);
    setRequests(requestsRes.requests ?? []);
    setPaymentSchedules(paymentsRes.schedules ?? []);
    setQuestionnaire(questionnaireRes.questionnaire ? { status: questionnaireRes.questionnaire.status } : null);
    setDocuments(documentsRes.documents ?? []);
    setTimelineUnpublished(!!timelineRes.hasUnpublishedChanges);
    setLoaded(true);
  }, [token, initialTasks, initialVendorTasks, initialTimelineHasUnpublishedChanges]);

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
      const completed = venueTasks.find((t) => t.id === rawId);
      const undoable =
        !(completed?.autoCompleteTrigger ?? null)
        && completed?.visibility === "client_owned";
      setVenueTasks((p) => p.map((t) =>
        t.id === rawId
          ? { ...t, status: "complete" as const, canComplete: false, canUndo: undoable, completedAt: new Date().toISOString() }
          : t,
      ));
      celebrateTaskComplete("Nice work — one less thing to worry about!");
      if (undoable) {
        toast.message("Task completed", {
          action: {
            label: "Undo",
            onClick: () => { void handleUndo(taskId); },
          },
          duration: 4000,
        });
      } else {
        toast.success("Task completed");
      }
    } else {
      toast.error("Could not complete task.");
    }
  }

  async function handleUndo(taskId: string) {
    const rawId = taskId.replace(/^task_/, "");
    setUndoing(taskId);
    const res = await fetch("/api/portal/undo-task", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, taskId: rawId }),
    });
    const data = await res.json() as { ok: boolean };
    setUndoing(null);
    if (data.ok) {
      setVenueTasks((p) => p.map((t) =>
        t.id === rawId
          ? {
              ...t,
              status: "pending" as const,
              canComplete: !(t.autoCompleteTrigger ?? null) && t.visibility === "client_owned",
              canUndo: false,
              completedAt: null,
            }
          : t,
      ));
      toast.success("Task reopened.");
    } else {
      toast.error("Could not undo task.");
    }
  }

  async function handleCompleteVendorTask(taskId: string) {
    setCompleting(`vendor_${taskId}`);
    const res = await fetch("/api/portal/complete-vendor-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, taskId }),
    });
    const data = await res.json() as { ok: boolean };
    setCompleting(null);
    if (data.ok) {
      setVendorTasks((p) => p.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "complete" as const,
              canComplete: false,
              canAcknowledge: false,
              completedBy: "couple" as const,
              completedAt: new Date().toISOString(),
            }
          : t,
      ));
      celebrateTaskComplete("Nice work — your vendor will see that it's done!");
    } else {
      toast.error("Could not complete task.");
    }
  }

  async function handleAcknowledgeVendorTask(taskId: string) {
    setCompleting(`vendor_ack_${taskId}`);
    const res = await fetch("/api/portal/acknowledge-vendor-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, taskId }),
    });
    const data = await res.json() as { ok: boolean };
    setCompleting(null);
    if (data.ok) {
      setVendorTasks((p) => p.map((t) =>
        t.id === taskId
          ? {
              ...t,
              coupleAcknowledgedAt: new Date().toISOString(),
              canAcknowledge: false,
              canComplete: false,
              status: "pending" as const,
              vendorReturnNote: null,
              returnedAt: null,
            }
          : t,
      ));
      toast.success("Got it — waiting for your vendor to confirm.");
    } else {
      toast.error("Could not update this request.");
    }
  }

  const allItems = buildUnifiedTaskList({
    venueTasks, requests, paymentSchedules, questionnaire, documents,
    timelineHasUnpublishedChanges: timelineUnpublished,
  });
  // Caption must match cards above COMPLETED — not raw venue_tasks alone.
  const { done: doneVenueTasks, total: totalVenueTasks } = unifiedTaskCompletionCounts(allItems);

  const [filter, setFilter] = React.useState<"all" | "requests">("all");
  const requestCount = allItems.filter((i) => i.kind === "request").length;
  const filtered = filter === "requests" ? allItems.filter((i) => i.kind === "request") : allItems;
  const { open: openItems, completed: completedVenueItems } = partitionByCompletion(filtered, {
    isComplete: (t) => t.completed,
    getDueDate: (t) => t.dueDate,
  });
  const { open: pendingVendor, completed: completedVendor } = partitionByCompletion(vendorTasks, {
    isComplete: (t) => t.status === "complete",
    getDueDate: (t) => t.dueDate,
  });

  if (!loaded) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  function renderVendorTask(t: PortalVendorTask) {
    const busy = completing === `vendor_${t.id}` || completing === `vendor_ack_${t.id}`;
    const shareTimeline =
      t.actionType === SHARE_TIMELINE_ACTION_TYPE
      && t.status !== "complete"
      && t.coupleVisibility === "owned";
    const shareCta = shareTimelineWorkspace();
    const confirmPhase = vendorConfirmCouplePhase({
      completionAuthority: t.completionAuthority,
      status: t.status,
      coupleAcknowledgedAt: t.coupleAcknowledgedAt,
    });
    const canAck = Boolean(t.canAcknowledge) || (
      t.completionAuthority === "vendor_confirm"
      && t.coupleVisibility === "owned"
      && t.status === "pending"
      && !t.coupleAcknowledgedAt
    );
    return (
      <div
        key={t.id}
        className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card px-3 py-3"
      >
        {shareTimeline ? (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
        ) : confirmPhase === "waiting" ? (
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : t.canComplete ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCompleteVendorTask(t.id)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:opacity-80 disabled:opacity-60"
            aria-label={`Mark ${t.title} complete`}
          >
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Circle className="h-4 w-4" />}
          </button>
        ) : t.status === "complete" ? (
          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-muted-foreground">{t.vendorName}</p>
          <p className={`text-sm font-medium text-heading ${t.status === "complete" ? "line-through text-muted-foreground" : ""}`}>
            {t.title}
          </p>
          {t.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
              <LinkifiedText
                text={t.notes}
                linkClassName="font-medium underline underline-offset-2 hover:opacity-80"
                linkStyle={{ color: "var(--venue-primary)" }}
              />
            </p>
          )}
          {t.dueDate && (
            <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
              Due {formatAbsoluteDueDate(t.dueDate)}
            </p>
          )}
          {t.attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {t.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.storageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline"
                  style={{ color: "var(--venue-primary)" }}
                >
                  <Paperclip className="h-3 w-3" />
                  {a.name}
                </a>
              ))}
            </div>
          )}
          {t.coupleVisibility === "visible" && t.status !== "complete" && (
            <p className="mt-1 text-[11px] text-muted-foreground">View only — your vendor will mark this complete</p>
          )}
          {confirmPhase === "waiting" && (
            <div className="mt-1 space-y-0.5">
              <p className="text-[11px] font-medium text-muted-foreground">Waiting for your vendor</p>
              <p className="text-[11px] text-muted-foreground">
                Your vendor will review this and confirm when it&apos;s complete.
              </p>
            </div>
          )}
          {confirmPhase === "complete" && t.completedBy === "vendor" && (
            <p className="mt-1 text-[11px] text-muted-foreground">Confirmed by your vendor</p>
          )}
          {t.vendorReturnNote && t.status === "pending" && confirmPhase === "open" && (
            <div className="mt-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-2">
              <p className="text-[11px] font-medium text-heading">Your vendor needs a few changes</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground whitespace-pre-wrap">
                {t.vendorReturnNote}
              </p>
            </div>
          )}
          {shareTimeline && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Completes when you share your timeline with this vendor
            </p>
          )}
        </div>
        {shareTimeline && (
          <button
            type="button"
            onClick={() => onNavigate(shareCta.section, shareCta.focus)}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--venue-primary)" }}
          >
            {shareCta.actionLabel}
          </button>
        )}
        {canAck && confirmPhase === "open" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAcknowledgeVendorTask(t.id)}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--venue-primary)" }}
          >
            {busy ? "Saving…" : "I've done this"}
          </button>
        )}
      </div>
    );
  }

  function renderVenueItem(item: UnifiedTask) {
    const Icon = KIND_ICON[item.kind];
    const busy = completing === item.id;
    const undoBusy = undoing === item.id;
    const hasOutbound = Boolean(item.externalUrl && item.confirmLabel && !item.completed);

    return (
      <div key={item.id} className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card px-3 py-3">
        {item.completed ? (
          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        ) : (
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium text-heading ${item.completed ? "line-through text-muted-foreground" : ""}`}>
            {item.title}
          </p>
          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
          {!item.completed && item.missingLinkHint && (
            <p className="text-xs text-muted-foreground mt-1">{item.missingLinkHint}</p>
          )}
          {(item.dueDate || item.daysOffset != null) && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{dueLabel(item)}</p>
          )}
        </div>
        {item.completed && item.undoableHere ? (
          <button
            type="button"
            disabled={undoBusy}
            onClick={() => void handleUndo(item.id)}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border/80 text-heading transition-opacity hover:opacity-80 disabled:opacity-60"
          >
            {undoBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Undo"}
          </button>
        ) : hasOutbound ? (
          <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
            <a
              href={item.externalUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--venue-primary)" }}
            >
              <ExternalLink className="h-3 w-3" />
              {item.actionLabel}
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleComplete(item.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-border/80 text-heading transition-opacity hover:opacity-80 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : item.confirmLabel}
            </button>
          </div>
        ) : !item.completed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => item.completableHere ? void handleComplete(item.id) : onNavigate(item.targetSection, item.targetFocus)}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--venue-primary)" }}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : item.actionLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* ── Band 1: From your venue ───────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-heading">From your venue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
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

        {openItems.length === 0 && completedVenueItems.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <CheckCircle2 className="h-7 w-7 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Nothing from the venue right now</p>
            <p className="text-xs mt-1">You&apos;re caught up on venue tasks.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openItems.map(renderVenueItem)}
            {completedVenueItems.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Completed
                </p>
                {completedVenueItems.map(renderVenueItem)}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Band 2: From your vendors ─────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-heading">From your vendors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tasks your vendors shared with you
            {pendingVendor.length > 0 ? ` · ${pendingVendor.length} open` : ""}.
          </p>
        </div>

        {vendorTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No shared vendor tasks yet. When a vendor shares something with you, it will show up here.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingVendor.map(renderVendorTask)}
            {completedVendor.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Completed
                </p>
                {completedVendor.map(renderVendorTask)}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
