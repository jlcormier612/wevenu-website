"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckSquare, ChevronDown, ChevronRight, Circle, Clock, Mail, Paperclip, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/leads/constants";
import { formatTime } from "@/lib/vendors/constants";
import { formatTimelineDayHeader, isMultiDayEvent } from "@/lib/timeline/constants";
import {
  completeEventTaskAction,
  completePersonalTaskAction,
  createPersonalTaskAction,
  uncompletePersonalTaskAction,
  updatePersonalTaskCoupleVisibilityAction,
  updateAssignmentNotesAction,
  toggleAssignmentCheckinAction,
  getVendorHandbookForEventAction,
  requestToLeaveEventAction,
} from "@/app/vendor/(workspace)/events/actions";
import { applyVendorTaskTemplatesAction } from "@/app/vendor/(workspace)/task-templates/actions";
import {
  getVendorConversationAction,
  getVendorConversationIdsForEventAction,
} from "@/app/vendor/(workspace)/messages/actions";
import { getVendorSharedFloorPlansForEventAction } from "@/app/vendor/(workspace)/floor-plans/actions";
import { VendorRelativeDuePicker } from "@/components/vendor-app/vendor-relative-due-picker";
import { LinkifiedText } from "@/components/shared/linkified-text";
import { VendorConversationThread } from "@/components/vendor-app/vendor-conversation-thread";
import { VendorEventSharePanel } from "@/components/vendor-app/vendor-event-share-panel";
import { DocumentWorkspace } from "@/components/document-workspace/document-workspace";
import { normalizeVendorEventDocuments } from "@/lib/document-workspace/vendor-normalize";
import { VendorHandbookView } from "@/components/vendor-app/vendor-handbook-view";
import { formatEventRelativeDue, offsetDate } from "@/lib/playbooks/due-dates";
import { partitionByCompletion } from "@/lib/tasks/group-by-completion";
import {
  vendorConfirmNeedsCoupleAck,
  vendorConfirmReadyToConfirm,
} from "@/lib/vendor-tasks/vendor-confirm-state";
import { VendorNeedsChangesControl } from "@/components/vendor-app/vendor-needs-changes-control";
import { eventTypeLabel } from "@/lib/leads/constants";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { applyDueLabel } from "@/lib/vendor-task-templates/presets";
import { sortTemplatesForEventApply } from "@/lib/vendor-task-templates/sort";
import type { VendorTaskTemplate } from "@/lib/vendor-task-templates/types";
import type {
  VendorActivityItem,
  VendorEventDetail,
  VendorPackage,
  VendorTaskCoupleVisibility,
} from "@/lib/vendors/types";
import type { VendorConversationMessage, VendorConversationSummary } from "@/lib/conversations/types";
import { vendorCounterpartyDisplayName } from "@/lib/conversations/vendor-counterparty";
import type { VendorFloorPlanSummary } from "@/lib/floor-plans/types";
import type { VendorHandbook } from "@/lib/vendor-handbook/service";
import type { VendorEventUpload, VendorLibraryDocument } from "@/lib/vendor-documents/types";

async function markVendorNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  try {
    await fetch("/api/vendor/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  } catch {
    // Soft-ack is best-effort — never block navigation
  }
}

function activityActorLabel(actor: VendorActivityItem["actor"]): string {
  if (actor === "vendor") return "You";
  if (actor === "couple") return "Couple";
  return "Venue";
}

const COUPLE_SHARE_OPTIONS: { value: string; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "visible", label: "Visible to couple" },
  { value: "owned", label: "Couple can mark complete" },
  { value: "owned_confirm", label: "Ask couple — I’ll confirm when done" },
];

type CoupleShareSelectValue = "private" | "visible" | "owned" | "owned_confirm";

function shareSelectValue(t: {
  coupleVisibility: VendorTaskCoupleVisibility;
  completionAuthority?: string;
}): CoupleShareSelectValue {
  if (
    t.coupleVisibility === "owned"
    && t.completionAuthority === "vendor_confirm"
  ) {
    return "owned_confirm";
  }
  return t.coupleVisibility;
}

function parseShareSelect(value: string): {
  coupleVisibility: VendorTaskCoupleVisibility;
  requireVendorConfirmation: boolean;
} {
  if (value === "owned_confirm") {
    return { coupleVisibility: "owned", requireVendorConfirmation: true };
  }
  const coupleVisibility = (
    value === "visible" || value === "owned" ? value : "private"
  ) as VendorTaskCoupleVisibility;
  return { coupleVisibility, requireVendorConfirmation: false };
}

const SHARE_LOCK_NOTICE =
  "Double-check before sharing — clients can\u2019t edit or delete these tasks from their portal after they\u2019re shared.";

// Vendor Workspace Realignment, Phase 5 (2026-07-22): tabs mirror the
// Client Workspace shape (Overview/Messages/Timeline/Tasks/Documents/Venue
// Information), plus Notes — private vendor-side notes with no equivalent
// anywhere else in the workspace, kept per the Phase 1 audit. Floor Plans
// folded into Documents (it's a document category, not a separate
// concept); Activity folded into Overview.
type Tab = "overview" | "messages" | "timeline" | "tasks" | "documents" | "venueinfo" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Overview"          },

  { id: "messages",  label: "Messages"          },
  { id: "timeline",  label: "Timeline"          },
  { id: "tasks",     label: "Tasks"             },
  { id: "documents", label: "Documents"         },
  { id: "venueinfo", label: "Venue Information" },
  { id: "notes",     label: "Notes"             },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "";
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function VendorEventWorkspace({
  detail,
  library = [],
  eventUploads = [],
  taskTemplates = [],
  packages = [],
  initialTab = "overview",
  highlight = null,
  focusTaskId = null,
  preferredThread = null,
}: {
  detail: VendorEventDetail;
  library?: import("@/lib/vendor-documents/types").VendorLibraryDocument[];
  eventUploads?: import("@/lib/vendor-documents/types").VendorEventUpload[];
  taskTemplates?: VendorTaskTemplate[];
  packages?: VendorPackage[];
  initialTab?: Tab;
  /** Light cue from Luv deep links — scroll/emphasize the relevant surface. */
  highlight?: "checkin" | "documents" | null;
  focusTaskId?: string | null;
  /** When opening Messages, prefer venue or couple thread. */
  preferredThread?: "venue" | "couple" | null;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [threadPref, setThreadPref] = React.useState<"venue" | "couple" | null>(preferredThread);
  const [hiddenActivityIds, setHiddenActivityIds] = React.useState<string[]>([]);

  // Soft client nav with ?tab=&focus= (bell / Luv) must open the target tab —
  // useState alone only applies on first mount.
  React.useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    if (focusTaskId) setTab("tasks");
  }, [focusTaskId]);

  React.useEffect(() => {
    if (preferredThread) setThreadPref(preferredThread);
  }, [preferredThread]);

  const activityFeed = detail.activityFeed.filter((i) => !hiddenActivityIds.includes(i.id));

  function softAckDocumentShared() {
    const docs = detail.activityFeed.filter((i) => i.type === "document_shared");
    if (docs.length === 0) return;
    const ids = docs.flatMap((i) => i.notificationIds ?? []);
    setHiddenActivityIds((prev) => {
      const next = new Set(prev);
      docs.forEach((i) => next.add(i.id));
      return [...next];
    });
    if (ids.length === 0) return;
    void markVendorNotificationsRead(ids).then(() => router.refresh());
  }

  function navigateTo(next: Tab, thread?: "venue" | "couple") {
    if (thread) setThreadPref(thread);
    if (next === "documents") softAckDocumentShared();
    setTab(next);
  }

  function handleActivityClick(item: VendorActivityItem) {
    if (item.type === "new_task" && item.needsAction) {
      setHiddenActivityIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      void markVendorNotificationsRead(item.notificationIds ?? []).then(() => router.refresh());
    }
    if (item.hrefTab) navigateTo(item.hrefTab, item.thread);
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/vendor/events" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Events
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-2xl font-medium text-heading">{detail.eventName}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-sm text-muted-foreground">
          <span>{detail.venueName}</span>
          {detail.eventDate && <span>· {formatDateRange(detail.eventDate, detail.eventEndDate)}</span>}
          {detail.eventType && <span>· {detail.eventType}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => navigateTo(id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {label}
              {id === "tasks" && detail.eventTasks.filter((t) => t.status !== "complete").length + detail.personalTasks.filter((t) => t.status !== "complete").length > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">
                  {detail.eventTasks.filter((t) => t.status !== "complete").length + detail.personalTasks.filter((t) => t.status !== "complete").length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === "overview"  && (
          <OverviewTab
            detail={detail}
            activityFeed={activityFeed}
            highlight={highlight}
            onNavigate={navigateTo}
            onActivityClick={handleActivityClick}
          />
        )}
        {tab === "messages"  && <MessagesTab   detail={detail} preferredThread={threadPref} />}
        {tab === "timeline"  && <TimelineTab   detail={detail} />}
        {tab === "tasks"     && (
          <TasksTab
            detail={detail}
            focusTaskId={focusTaskId}
            taskTemplates={taskTemplates}
            packages={packages}
          />
        )}
        {tab === "documents" && (
          <DocumentsTab
            detail={detail}
            library={library}
            eventUploads={eventUploads}
            highlight={highlight === "documents"}
          />
        )}
        {tab === "venueinfo" && <VenueInfoTab  detail={detail} />}
        {tab === "notes"     && <NotesTab      detail={detail} />}
      </div>
    </div>
  );
}

function formatDueLabel(iso: string): string {
  // Personal tasks and event tasks store due dates as YYYY-MM-DD (sometimes
  // with a time suffix). Parse as local calendar dates to avoid UTC drift.
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function OverviewTab({
  detail,
  activityFeed,
  highlight = null,
  onNavigate,
  onActivityClick,
}: {
  detail: VendorEventDetail;
  activityFeed: VendorActivityItem[];
  highlight?: "checkin" | "documents" | null;
  onNavigate: (tab: Tab, thread?: "venue" | "couple") => void;
  onActivityClick: (item: VendorActivityItem) => void;
}) {
  const [checkedInAt, setCheckedInAt] = React.useState(detail.checkedInAt);
  const [setupCompleteAt, setSetupCompleteAt] = React.useState(detail.setupCompleteAt);
  const [pendingField, setPendingField] = React.useState<"checked_in" | "setup_complete" | null>(null);
  const [, startTransition] = useTransition();
  const checkinRef = React.useRef<HTMLDivElement | null>(null);
  const emphasizeCheckin = highlight === "checkin";

  React.useEffect(() => {
    setCheckedInAt(detail.checkedInAt);
    setSetupCompleteAt(detail.setupCompleteAt);
  }, [detail.checkedInAt, detail.setupCompleteAt]);

  React.useEffect(() => {
    if (!emphasizeCheckin || !checkinRef.current) return;
    checkinRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [emphasizeCheckin]);

  const checkedIn = !!checkedInAt;
  const setupDone = !!setupCompleteAt;
  const [leavePending, setLeavePending] = React.useState(!!detail.hasPendingLeaveRequest);
  const [leaveConfirming, setLeaveConfirming] = React.useState(false);
  const [leaveReason, setLeaveReason] = React.useState("");
  const [leaveSubmitting, setLeaveSubmitting] = React.useState(false);

  React.useEffect(() => {
    setLeavePending(detail.hasPendingLeaveRequest);
  }, [detail.hasPendingLeaveRequest]);

  async function submitLeaveRequest() {
    setLeaveSubmitting(true);
    try {
      const result = await requestToLeaveEventAction(
        detail.assignmentId,
        leaveReason.trim() || null,
      );
      if (!result.ok) {
        toast.error(result.message ?? "Could not send request.");
        return;
      }
      setLeavePending(true);
      setLeaveConfirming(false);
      setLeaveReason("");
      toast.success("Request sent — the venue will confirm if you're removed.");
    } finally {
      setLeaveSubmitting(false);
    }
  }

  const openEventTasks = detail.eventTasks.filter((t) => t.status !== "complete");
  const openPersonalTasks = detail.personalTasks.filter((t) => t.status !== "complete");
  const openTaskCount = openEventTasks.length + openPersonalTasks.length;
  const nextDueTask = [...openEventTasks, ...openPersonalTasks]
    .map((t) => ({
      title: t.title,
      dueDate:
        t.dueDate
        ?? (t.daysOffset != null && detail.eventDate
          ? offsetDate(detail.eventDate, t.daysOffset)
          : null),
    }))
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })[0] ?? null;

  const latestDocument =
    [...detail.documents]
      .filter((d) => {
        if (!d.createdAt) return false;
        const ms = Date.parse(d.createdAt);
        return Number.isFinite(ms) && ms > 0;
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0]
    ?? detail.documents[0]
    ?? null;

  function toggleField(field: "checked_in" | "setup_complete") {
    const prevChecked = checkedInAt;
    const prevSetup = setupCompleteAt;
    const now = new Date().toISOString();

    if (field === "checked_in") setCheckedInAt(checkedInAt ? null : now);
    else setSetupCompleteAt(setupCompleteAt ? null : now);

    setPendingField(field);
    startTransition(async () => {
      const result = await toggleAssignmentCheckinAction(detail.assignmentId, field);
      setPendingField(null);
      if (!result.ok) {
        setCheckedInAt(prevChecked);
        setSetupCompleteAt(prevSetup);
        toast.error(result.message ?? "Could not update day-of status.");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Assignment info */}
      <div
        className={`rounded-sm border bg-card p-4 space-y-3 ${
          emphasizeCheckin ? "border-primary/50 ring-2 ring-primary/25" : "border-border"
        }`}
      >
        <h2 className="text-sm font-semibold text-foreground">Your assignment</h2>
        <div className="space-y-2 text-sm">
          {detail.arrivalTime && (
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-foreground">Arrival at {formatTime(detail.arrivalTime)}</span>
            </div>
          )}
          {detail.setupLocation && (
            <div>
              <p className="text-xs text-muted-foreground">Setup location</p>
              <p className="text-foreground">{detail.setupLocation}</p>
            </div>
          )}
          {detail.loadInNotes && (
            <div>
              <p className="text-xs text-muted-foreground">Load-in notes</p>
              <p className="text-foreground">{detail.loadInNotes}</p>
            </div>
          )}
          <div
            ref={checkinRef}
            className={`pt-1 space-y-2 border-t border-border/60 ${
              emphasizeCheckin ? "rounded-lg bg-primary/5 -mx-1 px-1 py-2" : ""
            }`}
          >
            <p className="text-xs text-muted-foreground">Day-of status</p>
            {emphasizeCheckin && (
              <p className="text-[11px] font-medium text-primary">Check in when you arrive</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Let the venue know you&apos;ve arrived and when setup is done. They&apos;ll see this on the wedding-day board.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleField("checked_in")}
                disabled={pendingField !== null}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                  checkedIn
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {pendingField === "checked_in" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {checkedIn
                  ? `Checked in · ${formatDateShort(checkedInAt!)}`
                  : "I've arrived"}
              </button>
              <button
                type="button"
                onClick={() => toggleField("setup_complete")}
                disabled={pendingField !== null}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                  setupDone
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {pendingField === "setup_complete" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {setupDone
                  ? `Setup complete · ${formatDateShort(setupCompleteAt!)}`
                  : "Setup complete"}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 space-y-2">
          {leavePending ? (
            <p className="text-xs text-muted-foreground">
              Event Removal Request sent — waiting for {detail.venueName} to confirm.
            </p>
          ) : leaveConfirming ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Ask {detail.venueName} to remove you from this event? You stay assigned until they confirm.
              </p>
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Optional reason…"
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={leaveSubmitting}
                  onClick={() => { setLeaveConfirming(false); setLeaveReason(""); }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={leaveSubmitting}
                  onClick={() => void submitLeaveRequest()}
                >
                  {leaveSubmitting ? "Sending…" : "Send request"}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLeaveConfirming(true)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Event Removal Request
            </button>
          )}
        </div>
      </div>

      {/* At a glance — actionable deep links into event tabs */}
      <div className="rounded-sm border border-border bg-card overflow-hidden">
        <h2 className="text-sm font-semibold text-foreground px-4 pt-4 pb-2">At a glance</h2>
        <div className="divide-y divide-border border-t border-border">
          <button
            type="button"
            onClick={() => onNavigate("tasks")}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {openTaskCount === 0
                  ? "No open tasks"
                  : `${openTaskCount} open task${openTaskCount === 1 ? "" : "s"}`}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {nextDueTask
                  ? nextDueTask.dueDate
                    ? `Next: ${nextDueTask.title} · ${formatDueLabel(nextDueTask.dueDate)}`
                    : `Next: ${nextDueTask.title}`
                  : "All caught up"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("documents")}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {detail.documents.length === 0
                  ? "No documents"
                  : `${detail.documents.length} document${detail.documents.length === 1 ? "" : "s"}`}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {latestDocument ? latestDocument.name : "Shared files for this event"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("messages", "venue")}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Message venue</p>
              <p className="text-xs text-muted-foreground">Open the venue thread</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          {detail.coupleName && (
            <button
              type="button"
              onClick={() => onNavigate("messages", "couple")}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Message couple</p>
                <p className="text-xs text-muted-foreground truncate">Open the couple thread</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}

          {(detail.coupleEmail || detail.couplePhone) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
              {detail.coupleEmail && (
                <a
                  href={`mailto:${detail.coupleEmail}`}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" /> {detail.coupleEmail}
                </a>
              )}
              {detail.couplePhone && (
                <a
                  href={`tel:${detail.couplePhone}`}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" /> {detail.couplePhone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agreed fee — coordination reference only. Payments happen outside
          Hello to Cheers; no paid/pending status is shown here. Hidden when
          the venue hasn't set a fee. */}
      {detail.agreedFee != null && (
        <div className="rounded-sm border border-border bg-card p-4 space-y-2 sm:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Agreed fee</h2>
          <p className="text-2xl font-semibold text-foreground">${detail.agreedFee.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            Tracked for coordination — payments happen outside Hello to Cheers.
          </p>
        </div>
      )}

      {/* Recent activity — attention surface: action-needed until addressed,
          FYI within 72h. Hidden when empty. */}
      {activityFeed.length > 0 && (
        <div className="rounded-sm border border-border bg-card overflow-hidden sm:col-span-2">
          <h2 className="text-sm font-semibold text-foreground px-4 pt-4 pb-2">Recent activity</h2>
          <div className="divide-y divide-border border-t border-border">
            {activityFeed.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onActivityClick(item)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    item.needsAction ? "bg-primary" : "bg-transparent"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activityActorLabel(item.actor)} · {formatRelative(item.occurredAt)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineTab({ detail }: { detail: VendorEventDetail }) {
  const router = useRouter();
  // Prefetch / open RSC payload can stay empty after the venue Publish-to-
  // Vendors — refresh once when this tab mounts with no items.
  React.useEffect(() => {
    if (detail.timeline.length === 0) router.refresh();
  }, [detail.timeline.length, router]);

  if (detail.timeline.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-border py-12 text-center">
        <p className="text-sm font-medium text-foreground">No timeline items yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          The venue shares day-of timing with vendors when they are ready.
          Check back once they release your items for this event.
        </p>
      </div>
    );
  }

  const multiDay = isMultiDayEvent(detail.eventDate, detail.eventEndDate);
  const sorted = [...detail.timeline].sort((a, b) => {
    const da = a.dayOffset ?? 0;
    const db = b.dayOffset ?? 0;
    if (da !== db) return da - db;
    if ((a.time ?? "") !== (b.time ?? "")) {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time < b.time ? -1 : 1;
    }
    return 0;
  });

  const byDay = new Map<number, typeof sorted>();
  for (const entry of sorted) {
    const day = entry.dayOffset ?? 0;
    const list = byDay.get(day) ?? [];
    list.push(entry);
    byDay.set(day, list);
  }

  return (
    <div className="space-y-5">
      {Array.from(byDay.entries()).map(([day, entries]) => (
        <div key={day} className="space-y-2">
          {multiDay && detail.eventDate && (
            <h3 className="font-heading text-sm font-semibold text-foreground border-b border-border pb-2">
              {formatTimelineDayHeader(detail.eventDate, day)}
            </h3>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-4 rounded-sm border border-border bg-card px-4 py-3">
              <div className="w-16 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">
                {entry.time ? formatTime(entry.time) : "—"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{entry.title}</p>
                {entry.description && <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TasksTab({
  detail,
  focusTaskId = null,
  taskTemplates = [],
  packages = [],
}: {
  detail: VendorEventDetail;
  focusTaskId?: string | null;
  taskTemplates?: VendorTaskTemplate[];
  packages?: VendorPackage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newTitle, setNewTitle]   = React.useState("");
  const [newDaysOffset, setNewDaysOffset] = React.useState("");
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [selectedItemIds, setSelectedItemIds] = React.useState<Set<string>>(new Set());
  const [expandedPackIds, setExpandedPackIds] = React.useState<Set<string>>(new Set());
  const [packageFilter, setPackageFilter] = React.useState<string>("__all__");
  const [applying, setApplying] = React.useState(false);
  const [applyShare, setApplyShare] = React.useState<CoupleShareSelectValue>("private");
  const [newShare, setNewShare] = React.useState<CoupleShareSelectValue>("private");
  const [newActionType, setNewActionType] = React.useState<"" | "share_timeline">("");
  const focusRef = React.useRef<HTMLDivElement | null>(null);
  const [activeFocusId, setActiveFocusId] = React.useState<string | null>(focusTaskId);

  const sortedPacks = sortTemplatesForEventApply(
    taskTemplates.filter((t) => t.isActive && t.items.length > 0),
    detail.eventType,
  );

  const filteredPacks =
    packageFilter === "__all__"
      ? sortedPacks
      : packageFilter === "__none__"
        ? sortedPacks.filter((t) => !t.packageId)
        : sortedPacks.filter((t) => t.packageId === packageFilter);

  const hasAnyTemplates = taskTemplates.some((t) => t.isActive && t.items.length > 0);

  // Deep-link from notifications / Luv: scroll to task and briefly highlight.
  React.useEffect(() => {
    if (!focusTaskId) {
      setActiveFocusId(null);
      return;
    }
    setActiveFocusId(focusTaskId);
    const scrollTimer = window.setTimeout(() => {
      focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    const clearTimer = window.setTimeout(() => setActiveFocusId(null), 2800);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusTaskId]);

  function openApply() {
    setPackageFilter("__all__");
    setSelectedItemIds(new Set());
    setExpandedPackIds(new Set(sortedPacks.map((p) => p.id)));
    setApplyShare("private");
    setApplyOpen(true);
  }

  function togglePackExpanded(packId: string) {
    setExpandedPackIds((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  }

  function toggleItemSelected(itemId: string, checked: boolean) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  function togglePackSelected(pack: VendorTaskTemplate, checked: boolean) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      for (const item of pack.items) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  }

  function packSelectionState(pack: VendorTaskTemplate): boolean | "indeterminate" {
    const ids = pack.items.map((i) => i.id);
    const selected = ids.filter((id) => selectedItemIds.has(id)).length;
    if (selected === 0) return false;
    if (selected === ids.length) return true;
    return "indeterminate";
  }

  function handleCompleteEvent(taskId: string) {
    startTransition(async () => { await completeEventTaskAction(taskId, detail.assignmentId); });
  }
  function handleCompletePersonal(taskId: string) {
    startTransition(async () => { await completePersonalTaskAction(taskId, detail.assignmentId); });
  }
  function handleUncompletePersonal(taskId: string) {
    startTransition(async () => { await uncompletePersonalTaskAction(taskId, detail.assignmentId); });
  }
  function handleShareChange(taskId: string, shareValue: string) {
    startTransition(async () => {
      const { coupleVisibility, requireVendorConfirmation } = parseShareSelect(shareValue);
      const result = await updatePersonalTaskCoupleVisibilityAction(
        taskId,
        detail.assignmentId,
        coupleVisibility,
        { requireVendorConfirmation },
      );
      if (!result.ok) {
        toast.error(result.message ?? "Could not update sharing.");
        return;
      }
      if (coupleVisibility !== "private") {
        toast.message(SHARE_LOCK_NOTICE);
      }
      router.refresh();
    });
  }
  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    startTransition(async () => {
      const { coupleVisibility, requireVendorConfirmation } = parseShareSelect(newShare);
      const result = await createPersonalTaskAction(detail.assignmentId, {
        title:             newTitle.trim(),
        dueDate:           "",
        daysOffset:        newDaysOffset,
        vendorInquiryId:   "",
        eventId:           detail.eventId,
        notes:             "",
        coupleVisibility,
        actionType:
          !requireVendorConfirmation
          && coupleVisibility !== "private"
          && newActionType === "share_timeline"
            ? "share_timeline"
            : null,
        requireVendorConfirmation,
      });
      if (!result.ok) {
        toast.error("message" in result ? (result.message ?? "Could not save task.") : "Could not save task.");
        return;
      }
      setNewTitle("");
      setNewDaysOffset("");
      setNewShare("private");
      setNewActionType("");
      router.refresh();
    });
  }

  async function handleApplyTemplates() {
    if (selectedItemIds.size === 0) return;
    setApplying(true);
    try {
      const result = await applyVendorTaskTemplatesAction(
        detail.assignmentId,
        [...selectedItemIds],
        applyShare === "owned_confirm" ? "owned" : applyShare === "visible" || applyShare === "owned" ? applyShare : "private",
        { requireVendorConfirmation: applyShare === "owned_confirm" },
      );
      if (!result.ok) {
        toast.error(result.message ?? "Could not apply Task Templates.");
        return;
      }
      const n = result.createdCount ?? selectedItemIds.size;
      toast.success(n === 1 ? "1 task added." : `${n} tasks added.`);
      if (result.warnedNoEventDate) {
        toast.message("This event has no date — relative due dates were left blank.");
      }
      setApplyOpen(false);
      router.refresh();
    } finally {
      setApplying(false);
    }
  }

  const allEmpty = detail.eventTasks.length === 0 && detail.personalTasks.length === 0;
  const { open: openEventTasks, completed: completedEventTasks } = partitionByCompletion(detail.eventTasks, {
    isComplete: (t) => t.status === "complete",
    getDueDate: (t) => t.dueDate,
  });
  const { open: openPersonalTasks, completed: completedPersonalTasks } = partitionByCompletion(detail.personalTasks, {
    isComplete: (t) => t.status === "complete",
    getDueDate: (t) => t.dueDate,
  });
  const focusClass = "bg-primary/5 ring-1 ring-inset ring-primary/30 transition-colors duration-500";
  const packageFilterItems = [
    { value: "__all__", label: "All packages" },
    { value: "__none__", label: "No package tag" },
    ...packages.map((p) => ({ value: p.id, label: p.name })),
  ];

  function renderEventTask(t: (typeof detail.eventTasks)[number]) {
    const isFocused = activeFocusId === t.id;
    return (
      <div
        key={t.id}
        id={`task-${t.id}`}
        ref={focusTaskId === t.id ? focusRef : undefined}
        className={`flex items-start gap-3 px-4 py-3 ${isFocused ? focusClass : ""}`}
      >
        <button
          type="button"
          onClick={() => t.canComplete && t.status !== "complete" && handleCompleteEvent(t.id)}
          disabled={!t.canComplete || t.status === "complete" || pending}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          {t.status === "complete"
            ? <CheckSquare className="h-4 w-4 text-success" />
            : <Circle className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${t.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {t.title}
          </p>
          {(t.dueDate || t.daysOffset != null) && (
            <p className="text-xs text-muted-foreground">
              {formatEventRelativeDue({
                daysOffset: t.daysOffset,
                dueDate: t.dueDate,
                dueDateLocked: t.dueDateLocked,
                eventDate: detail.eventDate,
                style: "planning",
              })}
            </p>
          )}
        </div>
        {t.isRequired && <Badge variant="outline" className="text-xs shrink-0">Required</Badge>}
      </div>
    );
  }

  function renderPersonalTask(t: (typeof detail.personalTasks)[number]) {
    const isFocused = activeFocusId === t.id;
    const awaitingCoupleAck = vendorConfirmNeedsCoupleAck(t);
    const readyToConfirm = vendorConfirmReadyToConfirm(t);
    const coupleSaidDone =
      t.completionAuthority === "vendor_confirm"
      && t.coupleVisibility === "owned"
      && t.status === "pending"
      && Boolean(t.coupleAcknowledgedAt);
    return (
      <div
        key={t.id}
        id={`task-${t.id}`}
        ref={focusTaskId === t.id ? focusRef : undefined}
        className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start ${isFocused ? focusClass : ""}`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            onClick={() => {
              if (awaitingCoupleAck) {
                toast.message("Wait until the couple says this is done before confirming.");
                return;
              }
              if (t.status === "pending") handleCompletePersonal(t.id);
              else handleUncompletePersonal(t.id);
            }}
            disabled={pending || awaitingCoupleAck}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
          >
            {t.status === "complete"
              ? <CheckSquare className="h-4 w-4 text-success" />
              : <Circle className="h-4 w-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${t.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {t.title}
            </p>
            {t.notes && (
              <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap line-clamp-3">
                <LinkifiedText
                  text={t.notes}
                  linkClassName="font-medium text-primary underline underline-offset-2 hover:opacity-80"
                />
              </p>
            )}
            {(t.attachments?.length ?? 0) > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {t.attachments!.map((a) => (
                  <a
                    key={a.id}
                    href={a.storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <Paperclip className="h-3 w-3" />
                    {a.name}
                  </a>
                ))}
              </div>
            )}
            {coupleSaidDone && (
              <p className="mt-1 text-[11px] font-medium text-foreground">
                Couple says this is done — confirm when you&apos;ve reviewed it
              </p>
            )}
            {awaitingCoupleAck && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Waiting for the couple to say this is done
              </p>
            )}
            {/* vendor_confirm never attributes completion to the couple */}
            {t.completedBy === "couple"
              && t.status === "complete"
              && t.completionAuthority !== "vendor_confirm" && (
              <p className="mt-1 text-[11px] text-muted-foreground">Completed by couple</p>
            )}
            {t.completedBy === "vendor" && t.status === "complete" && (
              <p className="mt-1 text-[11px] text-muted-foreground">Completed by you</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end sm:pl-2">
          {(t.dueDate || t.daysOffset != null) && (
            <p className="text-xs text-muted-foreground">
              {formatEventRelativeDue({
                daysOffset: t.daysOffset,
                dueDate: t.dueDate,
                eventDate: detail.eventDate,
                style: "planning",
              }) || t.dueDate}
            </p>
          )}
          {readyToConfirm && (
            <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={pending}
                onClick={() => handleCompletePersonal(t.id)}
              >
                Confirm
              </Button>
              <VendorNeedsChangesControl
                taskId={t.id}
                assignmentId={detail.assignmentId}
                pending={pending}
                onReturned={() => router.refresh()}
              />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Share with couple
            </p>
            <Select
              value={shareSelectValue(t)}
              onValueChange={(v) => handleShareChange(t.id, v)}
              items={COUPLE_SHARE_OPTIONS}
              disabled={pending}
            >
              <SelectTrigger className="h-8 w-full min-w-[10.5rem] text-xs sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUPLE_SHARE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Venue-assigned tasks */}
      {detail.eventTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned by venue</h3>
          {openEventTasks.length > 0 && (
            <div className="rounded-sm border border-border bg-card divide-y divide-border">
              {openEventTasks.map(renderEventTask)}
            </div>
          )}
          {completedEventTasks.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
              <div className="rounded-sm border border-border bg-card divide-y divide-border">
                {completedEventTasks.map(renderEventTask)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vendor's own event tasks (template-sourced + ad-hoc) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your tasks</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openApply}
            disabled={!hasAnyTemplates}
          >
            Apply Task Templates
          </Button>
        </div>
        {detail.personalTasks.length > 0 ? (
          <>
            {openPersonalTasks.length > 0 && (
              <div className="rounded-sm border border-border bg-card divide-y divide-border">
                {openPersonalTasks.map(renderPersonalTask)}
              </div>
            )}
            {completedPersonalTasks.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
                <div className="rounded-sm border border-border bg-card divide-y divide-border">
                  {completedPersonalTasks.map(renderPersonalTask)}
                </div>
              </div>
            )}
          </>
        ) : (
          !allEmpty && <p className="text-xs text-muted-foreground py-2">No tasks of your own for this event yet.</p>
        )}

        {!hasAnyTemplates && (
          <p className="text-xs text-muted-foreground">
            Create reusable templates under{" "}
            <Link href="/vendor/task-templates" className="text-primary hover:underline">Task Templates</Link>
            , then apply them here.
          </p>
        )}

        <form onSubmit={handleAddTask} className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-start">
          <input
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[12rem]"
            placeholder="Add a task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <VendorRelativeDuePicker
            value={newDaysOffset}
            onChange={setNewDaysOffset}
            className="w-full sm:w-52"
            triggerClassName="w-full"
          />
          <Select
            value={newShare}
            onValueChange={(v) => {
              const next = v as CoupleShareSelectValue;
              setNewShare(next);
              if (next === "private" || next === "owned_confirm") setNewActionType("");
            }}
            items={COUPLE_SHARE_OPTIONS}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUPLE_SHARE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(newShare === "visible" || newShare === "owned") && (
            <Select
              value={newActionType || "__none__"}
              onValueChange={(v) => setNewActionType(v === "share_timeline" ? "share_timeline" : "")}
              items={[
                { value: "__none__", label: newShare === "owned" ? "Couple marks complete" : "No couple action" },
                ...(newShare === "owned"
                  ? [{ value: "share_timeline", label: "Share timeline" }]
                  : []),
              ]}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {newShare === "owned" ? "Couple marks complete" : "No couple action"}
                </SelectItem>
                {newShare === "owned" && (
                  <SelectItem value="share_timeline">Share timeline</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
          <Button type="submit" size="sm" disabled={pending || !newTitle.trim()}>Add</Button>
        </form>
        {newShare !== "private" && (
          <p className="text-[11px] text-muted-foreground">{SHARE_LOCK_NOTICE}</p>
        )}
      </div>

      <Sheet open={applyOpen} onOpenChange={setApplyOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md p-0">
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle>Apply Task Templates</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {packages.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Filter by package tag</p>
                <Select
                  value={packageFilter}
                  onValueChange={setPackageFilter}
                  items={packageFilterItems}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {packageFilterItems.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {filteredPacks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active Task Templates with tasks match this filter.</p>
            ) : (
              <ul className="space-y-3">
                {filteredPacks.map((pack) => {
                  const expanded = expandedPackIds.has(pack.id);
                  const packState = packSelectionState(pack);
                  const packMeta = [
                    pack.eventType ? eventTypeLabel(pack.eventType) : null,
                    pack.packageName ?? null,
                    `${pack.items.length} task${pack.items.length === 1 ? "" : "s"}`,
                  ].filter(Boolean).join(" · ");
                  return (
                    <li key={pack.id} className="rounded-sm border border-border bg-card">
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <Checkbox
                          checked={packState === true}
                          onCheckedChange={(v) => togglePackSelected(pack, v === true)}
                          className="mt-1"
                          aria-label={`Select all tasks in ${pack.name}`}
                        />
                        <button
                          type="button"
                          className="mt-0.5 shrink-0 text-muted-foreground"
                          onClick={() => togglePackExpanded(pack.id)}
                          aria-label={expanded ? "Collapse" : "Expand"}
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{pack.name}</p>
                          {packMeta && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{packMeta}</p>
                          )}
                          {packState === "indeterminate" && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">Some tasks selected</p>
                          )}
                        </div>
                      </div>
                      {expanded && (
                        <ul className="border-t border-border divide-y divide-border">
                          {pack.items.map((item) => {
                            const checked = selectedItemIds.has(item.id);
                            return (
                              <li key={item.id}>
                                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 pl-10 hover:bg-muted/30">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => toggleItemSelected(item.id, v === true)}
                                    className="mt-0.5"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm text-foreground">{item.title}</span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                      {applyDueLabel(item.daysOffset)}
                                    </span>
                                    {item.notes && (
                                      <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                                        {item.notes}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <SheetFooter className="border-t border-border px-4 py-3 flex-col gap-3 sm:flex-col">
            <div className="w-full space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Share with couple</p>
              <Select
                value={applyShare}
                onValueChange={(v) => setApplyShare(v as CoupleShareSelectValue)}
                items={COUPLE_SHARE_OPTIONS}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUPLE_SHARE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Applied to every task created from this apply.
              </p>
              <p className="text-[11px] text-muted-foreground">
                {SHARE_LOCK_NOTICE}
              </p>
            </div>
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setApplyOpen(false)} disabled={applying}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleApplyTemplates()}
                disabled={applying || selectedItemIds.size === 0}
              >
                {applying
                  ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Applying…</>
                  : `Apply${selectedItemIds.size > 0 ? ` (${selectedItemIds.size})` : ""}`}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * Per-event Messages — Venue and Couple are separate pairwise threads
 * (same named labels as /vendor/messages).
 */
function MessagesTab({
  detail,
  preferredThread = null,
}: {
  detail: VendorEventDetail;
  preferredThread?: "venue" | "couple" | null;
}) {
  const [threads, setThreads] = React.useState<VendorConversationSummary[] | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<VendorConversationMessage[] | null>(null);
  const [activeMeta, setActiveMeta] = React.useState<VendorConversationSummary | null>(null);

  React.useEffect(() => {
    void getVendorConversationIdsForEventAction(detail.eventId).then((list) => {
      setThreads(list);
      const wantCouple = preferredThread === "couple";
      const preferred =
        list.find((c) =>
          wantCouple
            ? c.conversationKind === "couple_vendor"
            : c.conversationKind === "venue_vendor",
        )
        ?? list.find((c) => c.conversationKind === "venue_vendor")
        ?? list[0]
        ?? null;
      setActiveId(preferred?.conversationId ?? null);
      setActiveMeta(preferred);
    });
  }, [detail.eventId, preferredThread]);

  React.useEffect(() => {
    if (!activeId) {
      setMessages(null);
      return;
    }
    setMessages(null);
    void getVendorConversationAction(activeId).then((r) => {
      setMessages(r.ok ? r.conversation.messages : []);
    });
  }, [activeId]);

  if (threads === null || (activeId && messages === null)) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (!threads.length || !activeId) {
    return (
      <div className="rounded-sm border border-dashed border-border py-12 text-center">
        <p className="text-sm font-medium text-foreground">Messages</p>
        <p className="text-xs text-muted-foreground mt-1">No conversation for this event yet.</p>
      </div>
    );
  }

  const threadVenueName = activeMeta?.venueName?.trim() || detail.venueName;
  const threadCoupleName = activeMeta?.coupleName?.trim() || detail.coupleName;

  return (
    <div className="space-y-3">
      {threads.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {threads.map((t) => {
            const label = vendorCounterpartyDisplayName(
              t.counterpartyLabel,
              t.venueName?.trim() || detail.venueName,
              t.coupleName?.trim() || detail.coupleName,
            );
            return (
              <button
                key={t.conversationId}
                type="button"
                onClick={() => {
                  setActiveId(t.conversationId);
                  setActiveMeta(t);
                }}
                className={`max-w-full truncate rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeId === t.conversationId
                    ? t.counterpartyLabel === "Couple"
                      ? "border-[color-mix(in_oklch,var(--dusty-rose)_45%,var(--border))] bg-[color-mix(in_oklch,var(--dusty-rose)_14%,transparent)] text-foreground dark:border-[color-mix(in_oklch,var(--dusty-rose)_50%,transparent)] dark:bg-[color-mix(in_oklch,var(--dusty-rose)_20%,transparent)] dark:text-[var(--true-white)]"
                      : "border-[color-mix(in_oklch,var(--forest-sage)_40%,var(--border))] bg-[color-mix(in_oklch,var(--forest-sage)_10%,transparent)] text-foreground dark:border-[color-mix(in_oklch,var(--soft-sage)_45%,transparent)] dark:bg-white/10 dark:text-[var(--true-white)]"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {t.contactUnread > 0 ? ` (${t.contactUnread})` : ""}
              </button>
            );
          })}
        </div>
      )}
      <VendorConversationThread
        key={activeId}
        conversationId={activeId}
        initialMessages={messages ?? []}
        showHeader={false}
        eventName={activeMeta?.eventName}
        venueName={threadVenueName}
        coupleName={threadCoupleName}
        counterpartyLabel={activeMeta?.counterpartyLabel}
      />
    </div>
  );
}

/**
 * Documents + Floor Plans, unified (Phase 5/8: a Floor Plan is a document
 * category — a structured layout built in the coordinator's own Floor Plan
 * editor and shared via its own shared_with_vendors flag, not a PDF — not a
 * reason for a separate tab). "Open" on a floor plan renders the same
 * read-only SVG canvas the coordinator's print view uses.
 *
 * Vendor Documents V1: one event folder (venue + vendor shares + couple chip)
 * with a compose-only share panel below.
 */
function DocumentsTab({
  detail,
  library,
  eventUploads,
  highlight = false,
}: {
  detail: VendorEventDetail;
  library: VendorLibraryDocument[];
  eventUploads: VendorEventUpload[];
  highlight?: boolean;
}) {
  const [plans, setPlans] = React.useState<VendorFloorPlanSummary[] | null>(null);

  React.useEffect(() => {
    void getVendorSharedFloorPlansForEventAction(detail.eventId).then(setPlans);
  }, [detail.eventId]);

  if (plans === null) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading documents…</p>;
  }

  const workspaceDocuments = normalizeVendorEventDocuments(detail, eventUploads, plans);

  return (
    <div className={highlight ? "space-y-4 rounded-sm p-1 -m-1 ring-2 ring-primary/25 bg-primary/5" : "space-y-4"}>
      <DocumentWorkspace
        title="Event folder"
        description={`Files for this booking — from ${detail.venueName}, shared by you, and (when enabled) with the couple.`}
        documents={workspaceDocuments}
        initialPinnedKeys={[]}
        initialRecentEntries={[]}
        pinningEnabled={false}
      />
      <VendorEventSharePanel
        assignmentId={detail.assignmentId}
        eventId={detail.eventId}
        library={library}
        uploads={eventUploads}
        composeOnly
      />
    </div>
  );
}

function VenueInfoTab({ detail }: { detail: VendorEventDetail }) {
  const [handbook, setHandbook] = React.useState<VendorHandbook | null | undefined>(undefined);

  React.useEffect(() => {
    void getVendorHandbookForEventAction(detail.eventId).then(setHandbook);
  }, [detail.eventId]);

  if (handbook === undefined) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (!handbook) {
    return (
      <div className="rounded-sm border border-dashed border-border py-12 text-center">
        <p className="text-sm text-muted-foreground">Venue information isn&apos;t available for this event.</p>
      </div>
    );
  }
  return <VendorHandbookView handbook={handbook} />;
}

function NotesTab({ detail }: { detail: VendorEventDetail }) {
  const [notes, setNotes]     = React.useState(detail.internalNotes ?? "");
  const [edited, setEdited]   = React.useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateAssignmentNotesAction(detail.assignmentId, notes);
      setEdited(false);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Private notes visible only to you, not the venue or the client.</p>
      <textarea
        className="w-full rounded-sm border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[200px] resize-none"
        placeholder="Add your private notes for this event…"
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setEdited(true); }}
      />
      {edited && (
        <Button size="sm" onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save Notes"}
        </Button>
      )}
    </div>
  );
}
