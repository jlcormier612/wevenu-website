"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, CircleDashed, AlertTriangle, Clock, Minus, Loader2, Plus, ChevronDown, ChevronRight,
  FileText, Link2, MessageSquare, Clock3, X, Mail, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

import {
  addEventTaskContextLinkAction, applyPlaybookAction, completeTaskAction,
  createRequestForTaskAction,
  releasePlaybookAction,
  removeEventTaskContextLinkAction, setTaskStatusAction, updateEventTaskAssignmentAction, updateEventTaskNotesAction,
  updateEventTaskScheduleAction,
} from "@/app/(app)/playbooks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import {
  categoryColor, categoryLabel, formatClientPlanningTitle, formatScheduledTime, isScheduledActivity,
  PLAYBOOK_KINDS, STATUS_CONFIG, taskActionHref, taskActionLabel,
} from "@/lib/playbooks/constants";
import type {
  EventPlaybookApplication, EventTask, EventTaskContextLink, EventReadiness, PlaybookKind, PlaybookTemplateWithStats, TaskContact,
} from "@/lib/playbooks/types";
import type { Document } from "@/lib/documents/types";
import { STATUS_LABELS as REQUEST_STATUS_LABELS } from "@/lib/requests/constants";
import type { Request } from "@/lib/requests/types";
import type { TimelineEntry } from "@/lib/timeline/types";
import { cn } from "@/lib/utils";

export type LinkableConversationMessage = { id: string; label: string; detail: string };
export type StaffOption = { id: string; name: string };

// A waiting task is still just a task — CircleDashed reads as "not yet
// actionable," never "restricted" (Planning Templates - Remaining Product
// Work, 2026-07-09; replaces the old Lock icon).
const STATUS_ICONS = {
  complete: Check,
  pending:  Clock,
  blocked:  CircleDashed,
  overdue:  AlertTriangle,
  waived:   Minus,
};

const CONTEXT_ICONS = { conversation_message: MessageSquare, document: FileText, timeline_entry: Clock3, link: Link2 };

// Warm, restrained — not a generic confetti burst (Planning Experience
// Review, 2026-07-08). Venue tasks get a quiet confirmation instead; a
// coordinator managing a dozen weddings doesn't want a celebration for the
// fortieth task this week.
function celebrateCompletion(kind: PlaybookKind, title: string) {
  if (kind === "client") toast.success(`🎉 Nicely done — "${title}" is complete.`);
  else toast.success(`"${title}" complete.`);
}

// ---- Related Context / Helpful Information ----------------------------------

function ContextLinkRow({ link, eventId, onRemove, removing }: { link: EventTaskContextLink; eventId: string; onRemove: () => void; removing: boolean }) {
  const Icon = CONTEXT_ICONS[link.sourceType];
  // Timeline Integration task: a linked Timeline entry is the one context
  // link type that opens somewhere — the Booking Timeline already listens
  // for #timeline on this same page.
  const label = link.sourceType === "timeline_entry"
    ? <Link href={`/events/${eventId}#timeline`} className="text-xs font-medium text-primary hover:underline">{link.label}</Link>
    : <p className="text-xs font-medium text-foreground">{link.label}</p>;
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        {label}
        {link.detail && <p className="truncate text-[11px] text-muted-foreground">{link.detail}</p>}
      </div>
      <button type="button" onClick={onRemove} disabled={removing} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive" aria-label="Remove">
        {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      </button>
    </div>
  );
}

// A venue attaches an existing Document, Timeline entry, or Conversation
// message — never types a copy of it here (One Fact, One Owner). Options
// with nothing available simply don't appear; Conversation only shows up at
// all when the venue actually has messages to offer (Related Context refined
// per Planning Experience Review, 2026-07-08).
function AttachContextPicker({
  documents, timelineEntries, conversationMessages, alreadyLinkedIds, onAttach, pending,
}: {
  documents: Document[]; timelineEntries: TimelineEntry[]; conversationMessages: LinkableConversationMessage[];
  alreadyLinkedIds: Set<string>; onAttach: (sourceType: EventTaskContextLink["sourceType"], sourceId: string) => void; pending: boolean;
}) {
  const [value, setValue] = React.useState("");
  const options = [
    ...documents.filter((d) => !alreadyLinkedIds.has(d.id)).map((d) => ({ value: `document:${d.id}`, label: `📎 ${d.name || d.fileName}` })),
    ...timelineEntries.filter((t) => !alreadyLinkedIds.has(t.id)).map((t) => ({ value: `timeline_entry:${t.id}`, label: `🕒 ${t.title}` })),
    ...conversationMessages.filter((m) => !alreadyLinkedIds.has(m.id)).map((m) => ({ value: `conversation_message:${m.id}`, label: `💬 ${m.detail}` })),
  ];
  if (options.length === 0) return null;

  function handleAttach() {
    if (!value) return;
    const [sourceType, sourceId] = value.split(/:(.+)/) as [EventTaskContextLink["sourceType"], string];
    onAttach(sourceType, sourceId);
    setValue("");
  }

  return (
    <div className="flex items-center gap-1.5 pt-1">
      <Select value={value} onValueChange={setValue} items={options}>
        <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Attach…" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button type="button" size="sm" variant="outline" onClick={handleAttach} disabled={!value || pending} className="h-7 px-2 text-xs shrink-0">
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Attach"}
      </Button>
    </div>
  );
}

// ---- Scheduled Activity (Calendar Integration — Phase 1) ---------------------
// Venue-only, progressive disclosure: unchecked, a task stays exactly what it
// is today (due-date only). Checking the box reveals date/time/location and
// is the one moment a coordinator declares "this is something I show up to."

function TaskScheduleSection({ task, eventId }: { task: EventTask; eventId: string }) {
  const [enabled, setEnabled] = React.useState(isScheduledActivity(task));
  const [date, setDate] = React.useState(task.scheduledDate ?? "");
  const [startTime, setStartTime] = React.useState(task.scheduledStartTime ?? "");
  const [endTime, setEndTime] = React.useState(task.scheduledEndTime ?? "");
  const [location, setLocation] = React.useState(task.location ?? "");
  const [saving, startSave] = React.useTransition();

  const isDirty = enabled !== isScheduledActivity(task)
    || date !== (task.scheduledDate ?? "")
    || startTime !== (task.scheduledStartTime ?? "")
    || endTime !== (task.scheduledEndTime ?? "")
    || location !== (task.location ?? "");

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    if (!checked) { setDate(""); setStartTime(""); setEndTime(""); setLocation(""); }
  }

  function handleSave() {
    startSave(async () => {
      const result = await updateEventTaskScheduleAction(task.id, eventId, {
        scheduledDate: enabled ? (date || null) : null,
        scheduledStartTime: enabled ? (startTime || null) : null,
        scheduledEndTime: enabled ? (endTime || null) : null,
        location: enabled ? (location || null) : null,
      });
      if (result.ok) toast.success("Scheduled activity saved.");
      else toast.error(result.message ?? "Could not save schedule.");
    });
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer">
        <Checkbox checked={enabled} onCheckedChange={(v) => handleToggle(v === true)} />
        Scheduled Activity
      </label>
      {enabled && (
        <div className="space-y-1.5 pl-0.5">
          <div className="flex gap-1.5">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 flex-1 text-xs" />
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-7 w-28 text-xs" placeholder="Start" />
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-7 w-28 text-xs" placeholder="End" />
          </div>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" className="h-7 text-xs" />
        </div>
      )}
      {isDirty && (
        <Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={saving} className="h-7 px-2 text-xs">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save schedule"}
        </Button>
      )}
    </div>
  );
}

// ---- Staff assignment (Planning Release Readiness Fixes) --------------------
// Venue-only — a Client Planning task's "owner" is the couple, never a staff
// member. assigned_to_staff_id already drove Calendar's staff filter and the
// couple-facing contact line; this closes the one gap where nothing on the
// team side could actually set it.

function TaskAssignmentSection({ task, eventId, staffOptions }: { task: EventTask; eventId: string; staffOptions: StaffOption[] }) {
  const [staffId, setStaffId] = React.useState(task.assignedToStaffId ?? "");
  const [saving, startSave] = React.useTransition();
  const options = [{ value: "", label: "Unassigned" }, ...staffOptions.map((s) => ({ value: s.id, label: s.name }))];

  function handleChange(value: string) {
    setStaffId(value);
    startSave(async () => {
      const result = await updateEventTaskAssignmentAction(task.id, eventId, value || null);
      if (result.ok) toast.success(value ? "Task assigned." : "Task unassigned.");
      else toast.error(result.message ?? "Could not update assignment.");
    });
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned To</p>
      <div className="flex items-center gap-1.5">
        <Select value={staffId} onValueChange={handleChange} items={options}>
          <SelectTrigger className="h-7 w-48 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>{options.map((o) => <SelectItem key={o.value || "unassigned"} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}

// ---- Task detail — "the place someone finds everything needed to do the work" --

function TaskDetailPanel({
  task, kind, eventId, contextLinks, contact, documents, timelineEntries, conversationMessages, staffOptions, onNotesUpdated,
}: {
  task: EventTask; kind: PlaybookKind; eventId: string; contextLinks: EventTaskContextLink[]; contact: TaskContact | null;
  documents: Document[]; timelineEntries: TimelineEntry[]; conversationMessages: LinkableConversationMessage[];
  staffOptions: StaffOption[];
  onNotesUpdated: () => void;
}) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(task.notes ?? "");
  const [savingNotes, startSaveNotes] = React.useTransition();
  const [attaching, startAttach] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const isVenue = kind === "venue";
  // Client Planning tasks only ever surface the parts of Related Context
  // appropriate to share — Documents and links (embedded tools), presented
  // as Helpful Information. Internal Notes and raw Conversation never cross
  // to the couple's side (Internal Notes vs. Helpful Information, Planning
  // Experience Review).
  const visibleLinks = isVenue ? contextLinks : contextLinks.filter((l) => l.sourceType === "document" || l.sourceType === "link");
  const alreadyLinkedIds = new Set(contextLinks.map((l) => l.sourceId));

  function handleSaveNotes() {
    startSaveNotes(async () => {
      const result = await updateEventTaskNotesAction(task.id, eventId, notes);
      if (result.ok) { toast.success("Internal note saved."); onNotesUpdated(); }
      else toast.error(result.message ?? "Could not save note.");
    });
  }

  function handleAttach(sourceType: EventTaskContextLink["sourceType"], sourceId: string) {
    startAttach(async () => {
      const result = await addEventTaskContextLinkAction(task.id, eventId, sourceType, sourceId);
      if (result.ok) router.refresh();
      else toast.error(result.message ?? "Could not attach.");
    });
  }

  async function handleRemove(linkId: string) {
    setRemovingId(linkId);
    const result = await removeEventTaskContextLinkAction(linkId, eventId);
    setRemovingId(null);
    if (result.ok) router.refresh();
    else toast.error(result.message ?? "Could not remove.");
  }

  return (
    <div className="ml-7 mb-2 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}

      {!isVenue && contact && (
        <p className="text-xs text-muted-foreground">
          Questions? Reach out to <span className="font-medium text-foreground">{contact.name}</span>
          {contact.email && <> · <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-0.5 text-primary hover:underline"><Mail className="h-3 w-3" />{contact.email}</a></>}
        </p>
      )}

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isVenue ? "Related Context" : "Helpful Information"}
        </p>
        {visibleLinks.length === 0 && <p className="text-xs text-muted-foreground">Nothing attached yet.</p>}
        {visibleLinks.map((link) => (
          <ContextLinkRow key={link.id} link={link} eventId={eventId} onRemove={() => handleRemove(link.id)} removing={removingId === link.id} />
        ))}
        {isVenue && (
          <AttachContextPicker
            documents={documents} timelineEntries={timelineEntries} conversationMessages={conversationMessages}
            alreadyLinkedIds={alreadyLinkedIds} onAttach={handleAttach} pending={attaching}
          />
        )}
        {!isVenue && (
          <AttachContextPicker
            documents={documents} timelineEntries={[]} conversationMessages={[]}
            alreadyLinkedIds={alreadyLinkedIds} onAttach={handleAttach} pending={attaching}
          />
        )}
      </div>

      {isVenue && <TaskScheduleSection task={task} eventId={eventId} />}

      {isVenue && <TaskAssignmentSection task={task} eventId={eventId} staffOptions={staffOptions} />}

      {isVenue && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Internal Notes</p>
          <Textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Notes for your team — never shown to the client."
            className="text-xs"
          />
          {notes !== (task.notes ?? "") && (
            <Button type="button" size="sm" variant="outline" onClick={handleSaveNotes} disabled={savingNotes} className="h-7 px-2 text-xs">
              {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save note"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Task row -----------------------------------------------------------------

function TaskRow({
  task, kind, eventId, clientId, clientName, request, expanded, onToggleExpand, onUpdate, contextLinks, contact, documents, timelineEntries, conversationMessages, staffOptions,
}: {
  task: EventTask; kind: PlaybookKind; eventId: string; clientId: string | null; clientName: string | null;
  request: Request | null; expanded: boolean; onToggleExpand: () => void;
  onUpdate: (id: string, status: EventTask["status"]) => void;
  contextLinks: EventTaskContextLink[]; contact: TaskContact | null;
  documents: Document[]; timelineEntries: TimelineEntry[]; conversationMessages: LinkableConversationMessage[];
  staffOptions: StaffOption[];
}) {
  const router = useRouter();
  const [pending, startAction] = React.useTransition();
  const [creatingRequest, setCreatingRequest] = React.useState(false);
  const cfg = STATUS_CONFIG[task.status];
  const Icon = STATUS_ICONS[task.status];
  const isComplete = task.status === "complete";
  const isBlocked = task.status === "blocked";

  function handleComplete() {
    startAction(async () => {
      const result = await completeTaskAction(task.id, eventId);
      if (result.ok) { onUpdate(task.id, "complete"); celebrateCompletion(kind, task.title); }
      else toast.error(result.message ?? "Could not complete task.");
    });
  }

  function handleWaive() {
    startAction(async () => {
      const next = task.status === "waived" ? "pending" : "waived";
      const result = await setTaskStatusAction(task.id, eventId, next);
      if (result.ok) { onUpdate(task.id, next); }
      else toast.error(result.message ?? "Could not update task.");
    });
  }

  // A completed task had no way back — a coordinator who completed
  // something by mistake, or whose couple undid something in real life,
  // could not undo it through the product (Planning Release Readiness
  // Fixes). Reuses the same pending-transition the waive/restore toggle
  // already uses; nothing new at the data layer.
  function handleReopen() {
    startAction(async () => {
      const result = await setTaskStatusAction(task.id, eventId, "pending");
      if (result.ok) { onUpdate(task.id, "pending"); }
      else toast.error(result.message ?? "Could not reopen task.");
    });
  }

  // Request Framework integration: a task may optionally create a Request
  // when it needs client participation. Independent lifecycles — creating
  // or completing a Request never changes this task's own status.
  async function handleCreateRequest() {
    if (!clientId) { toast.error("This task has no linked client to request from."); return; }
    setCreatingRequest(true);
    const result = await createRequestForTaskAction({
      taskId: task.id, eventId, clientId,
      title: task.title, description: task.description, dueDate: task.dueDate,
      assignedToStaffId: task.assignedToStaffId,
    });
    setCreatingRequest(false);
    if (result.ok) { toast.success("Request created."); router.refresh(); }
    else toast.error(result.message ?? "Could not create request.");
  }

  return (
    <div className="border-b border-border/50 last:border-0">
      <div className={`group flex items-start gap-3 py-3 ${isBlocked ? "opacity-70" : ""}`}>
        <button type="button" onClick={onToggleExpand} className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground" aria-label="Expand">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <div className="shrink-0 mt-0.5">
          <Icon className="h-4 w-4" style={{ color: cfg.color }} />
        </div>

        <button type="button" onClick={onToggleExpand} className="min-w-0 flex-1 space-y-0.5 text-left">
          <p className={`text-sm font-medium ${isComplete ? "text-muted-foreground line-through" : "text-heading"}`}>
            {task.title}
            {!task.isRequired && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground uppercase tracking-wide">optional</span>}
            {/* Wedding-Day Visibility (Planning Execution — Release
                Completion) — same milestone_kind get_wedding_day_ops
                already reads; this is the first place a coordinator sees
                it while planning, not only after opening Wedding Day Ops. */}
            {task.milestoneKind === "event_day" && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground align-middle">
                💍 Wedding Day
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span style={{ color: categoryColor(task.category) }}>{categoryLabel(task.category)}</span>
            <span>·</span>
            <span>{task.ownerType === "couple" ? "Client" : task.ownerType === "vendor" ? "Vendor" : "Coordinator"}</span>
            <span>·</span>
            <span>{new Date(task.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            {isScheduledActivity(task) && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5 text-heading">
                  <Clock3 className="h-3 w-3" />
                  {formatScheduledTime(task.scheduledStartTime) ?? "Scheduled"}
                  {task.location && ` @ ${task.location}`}
                </span>
              </>
            )}
            {contextLinks.length > 0 && <><span>·</span><span>{contextLinks.length} attached</span></>}
          </div>
          {isBlocked && task.dependsOnTitle && (
            <p className="text-xs text-warning-foreground">
              <CircleDashed className="inline h-3 w-3 mr-0.5" /> Waiting on: {task.dependsOnTitle}
            </p>
          )}
          {task.autoCompleteTrigger && !isComplete && (
            <p className="text-[10px] text-muted-foreground italic">Auto-completes on trigger</p>
          )}
          {request && (
            <p className="text-xs text-muted-foreground">
              Request: <span className="font-medium text-heading">{REQUEST_STATUS_LABELS[request.status]}</span>
              {request.dueDate && <> · Due {new Date(request.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
              {clientName && <> · {clientName}</>}
            </p>
          )}
        </button>

        {request && (
          <Button
            size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0"
            render={<Link href={`/requests/${request.id}`} />}
          >
            Open Request
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        )}

        {!isComplete && !isBlocked && task.actionType && (
          // Navigation into the platform, not a static checklist item — "Choose
          // a florist" opens the Vendor Library, etc. (Vendor Management —
          // Next Iteration, 2026-07-10). Always visible, not hover-only, since
          // it's the primary way a task gets done, not a secondary management action.
          <Button
            size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0"
            render={<Link href={taskActionHref(task.actionType, eventId) ?? "#"} />}
          >
            {taskActionLabel(task.actionType, task.actionLabel)}
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        )}

        {!isComplete && !isBlocked && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {!request && (
              <Button type="button" size="sm" variant="ghost" onClick={handleCreateRequest} disabled={creatingRequest} className="h-7 px-2 text-xs text-muted-foreground">
                {creatingRequest ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create Request"}
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={handleComplete} disabled={pending} className="h-7 px-2 text-xs">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleWaive} disabled={pending} className="h-7 px-2 text-xs text-muted-foreground">
              {task.status === "waived" ? "Restore" : "Waive"}
            </Button>
          </div>
        )}

        {isComplete && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button type="button" size="sm" variant="ghost" onClick={handleReopen} disabled={pending} className="h-7 px-2 text-xs text-muted-foreground">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reopen"}
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <TaskDetailPanel
          task={task} kind={kind} eventId={eventId} contextLinks={contextLinks} contact={contact}
          documents={documents} timelineEntries={timelineEntries} conversationMessages={conversationMessages}
          staffOptions={staffOptions}
          onNotesUpdated={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ---- Apply row ------------------------------------------------------------------

// One row per planning kind — either "applied: <name>" or a picker scoped to
// that kind's templates. Client Planning and Venue Planning are separate
// systems and each gets its own independent apply action (Product Decisions,
// 2026-07-08) — never a single mixed dropdown.
//
// Client Planning has three states, all distinguishable at a glance (Draft →
// Release workflow, 2026-07-10): Not Applied (the dashed picker below),
// Draft (applied, private — "Edit Draft" / "Release to [Client]"), and
// Released (progress bar + milestone stepper, both already venue-side).
// Venue Planning only ever has two — Not Applied and Active — it has no
// draft state to show.
//
// "View Client Portal" was removed here (Planning Execution — Release
// Completion, Navigation Review): every capability it offered — milestone
// progress, task-level status, the readiness percentage — was already
// rendered venue-side (§2 of docs/planning-execution-release-readiness.md
// confirmed no coordinator workflow depended on it). Its continued
// existence was the one standing, unaudited path into a couple's own
// workspace that Client Identity Foundation's consented-access model was
// built to replace (docs/wedding-workspace-architecture.md §5, §15).
export function PlaybookApplyRow({
  kind, eventId, clientId, eventDate, eventName, clientName, eventType, templates, application, readiness, onApplied,
  preselectTemplateId,
}: {
  kind: PlaybookKind;
  eventId: string;
  clientId: string | null;
  eventDate: string;
  eventName: string;
  clientName: string | null;
  eventType: string | null;
  templates: PlaybookTemplateWithStats[];
  application: EventPlaybookApplication | undefined;
  readiness: EventReadiness | null;
  onApplied: () => void;
  /** Preselect the venue's default template for this kind/event type, when one exists — falls back to today's behavior (first template) when not given. */
  preselectTemplateId?: string;
}) {
  const meta = PLAYBOOK_KINDS.find((k) => k.value === kind)!;
  const [selectedTemplate, setSelectedTemplate] = React.useState(preselectTemplateId ?? templates[0]?.id ?? "");
  const [applying, startApply] = React.useTransition();
  const [releasing, startRelease] = React.useTransition();

  async function handleApply() {
    if (!selectedTemplate) return;
    startApply(async () => {
      const result = await applyPlaybookAction(eventId, selectedTemplate, eventDate);
      if (result.ok) { toast.success(`${meta.label} checklist applied — tasks generated.`); onApplied(); }
      else toast.error(result.message ?? "Could not apply playbook.");
    });
  }

  function handleEditDraft() {
    document.getElementById("planning-task-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleRelease() {
    if (!clientId) return;
    const label = clientName ?? "your client";
    if (!confirm(`Release Client Planning to ${label}? They'll be able to see and complete these tasks, and reminders will start going out.`)) return;
    startRelease(async () => {
      const result = await releasePlaybookAction(eventId, clientId, clientName ?? "");
      if (result.ok) { toast.success("Client Planning released."); onApplied(); }
      else toast.error(result.message ?? "Could not release checklist.");
    });
  }

  if (application) {
    // The underlying model is always Client Planning — what's shown here is
    // the event-specific presentation of it, not the template's own name
    // (Product Decisions, 2026-07-08).
    const displayTitle = kind === "client" ? formatClientPlanningTitle(eventName, clientName, eventType) : application.templateName;
    // Progress reads differently per audience, on purpose (Planning
    // Experience Review, 2026-07-08): the couple sees a percentage; the
    // venue side sees "on track" / "N tasks need attention" — staying ahead
    // of operations is the feeling being designed for, not a personal-goal
    // percentage.
    const needsAttention = readiness ? readiness.blockedCount + readiness.overdueCount : 0;
    const isDraft = kind === "client" && !application.releasedAt;

    if (isDraft) {
      return (
        <div className="rounded-lg border border-dashed border-warning-foreground/30 bg-warning/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">{meta.emoji}</span>
            <p className="text-xs text-muted-foreground flex-1">
              <span className="font-medium text-heading">{meta.label}:</span> {displayTitle} — not yet visible to {clientName ?? "your client"}
            </p>
            <Badge variant="warning" className="text-[10px] shrink-0">Draft</Badge>
          </div>
          {readiness && (
            <p className="mt-1.5 pl-6 text-[11px] text-muted-foreground">{readiness.completedRequired} of {readiness.totalRequired} tasks</p>
          )}
          <div className="mt-2 pl-6 flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleEditDraft} className="h-7 px-2 text-xs">Edit Draft</Button>
            <Button type="button" size="sm" onClick={handleRelease} disabled={releasing} className="h-7 px-2 text-xs">
              {releasing ? <Loader2 className="h-3 w-3 animate-spin" /> : `Release to ${clientName ?? "Client"}`}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{meta.emoji}</span>
          <p className="text-xs text-muted-foreground flex-1">
            <span className="font-medium text-heading">{meta.label}:</span> {displayTitle} applied
          </p>
          <Badge variant="muted" className="text-[10px] shrink-0">
            {kind === "client" && application.releasedAt
              ? `Released ${new Date(application.releasedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "Active"}
          </Badge>
        </div>
        {readiness && (
          <div className="mt-1.5 flex items-center gap-2 pl-6">
            {kind === "client" ? (
              <>
                <div className="h-1.5 flex-1 max-w-[120px] rounded-full bg-border overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${readiness.score}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground">{readiness.completedRequired} of {readiness.totalRequired} complete</span>
              </>
            ) : (
              <span className={cn("text-[11px] font-medium", needsAttention === 0 ? "text-success" : "text-warning-foreground")}>
                {needsAttention === 0 ? "On track" : `${needsAttention} task${needsAttention === 1 ? "" : "s"} need attention`}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // No Planning Templates of this kind exist at the venue yet — this used
  // to silently render nothing, which left the empty-state message below
  // ("Apply a checklist above") pointing at a control that didn't exist.
  // Confirmed directly: a fresh venue with zero Playbook templates renders
  // both PlaybookApplyRow instances as null, leaving that message the only
  // thing on screen with no way to act on it.
  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{meta.emoji}</span>
          <p className="text-xs text-muted-foreground flex-1">
            No {meta.label} checklists yet — create one to apply here.
          </p>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0"
            render={<Link href="/library/playbooks" />}>
            Create a Template
          </Button>
        </div>
      </div>
    );
  }

  // Picking between two similarly-named templates ("Standard" vs "Standard —
  // Copy") with no way to tell them apart was a real gap — counts are the
  // cheapest possible differentiator, reusing the Library page's own stats
  // (Planning Release Readiness Fixes, UX Improvements).
  const selectedStats = templates.find((t) => t.id === selectedTemplate);

  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">{meta.emoji}</span>
        <p className="text-xs text-muted-foreground flex-1">No {meta.label} checklist applied</p>
        <Select value={selectedTemplate} onValueChange={setSelectedTemplate} items={templates.map((t) => ({ value: t.id, label: t.name }))}>
          <SelectTrigger className="h-7 w-40 text-xs shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} <span className="text-muted-foreground">— {t.milestoneCount} milestone{t.milestoneCount === 1 ? "" : "s"}, {t.taskCount} task{t.taskCount === 1 ? "" : "s"}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={handleApply} disabled={applying} className="h-7 px-2 text-xs shrink-0">
          {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="mr-1 h-3 w-3" />Apply</>}
        </Button>
      </div>
      {selectedStats && (
        <p className="mt-1 pl-6 text-[11px] text-muted-foreground">
          {selectedStats.milestoneCount} milestone{selectedStats.milestoneCount === 1 ? "" : "s"} · {selectedStats.taskCount} task{selectedStats.taskCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

// ---- Milestone stepper (Client Planning only) ------------------------------
// Answers "where am I in this journey," alongside the percentage, not
// instead of it (Planning Experience Review, 2026-07-08). Derived entirely
// from the already-applied tasks' milestone snapshots — no second source of
// truth for milestone order or names.

function MilestoneStepper({ tasks }: { tasks: EventTask[] }) {
  if (tasks.length === 0) return null;
  const seen = new Set<string>();
  const milestoneNames: string[] = [];
  for (const t of tasks) {
    if (!seen.has(t.milestoneName)) { seen.add(t.milestoneName); milestoneNames.push(t.milestoneName); }
  }
  const firstIncompleteMilestone = tasks.find((t) => t.status !== "complete" && t.status !== "waived")?.milestoneName;
  const currentIndex = firstIncompleteMilestone ? milestoneNames.indexOf(firstIncompleteMilestone) : milestoneNames.length - 1;

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {milestoneNames.map((name, i) => (
        <React.Fragment key={name}>
          {i > 0 && <span className="text-muted-foreground">──</span>}
          <span className={cn(
            "flex items-center gap-1",
            i < currentIndex ? "text-muted-foreground" : i === currentIndex ? "font-semibold text-primary" : "text-muted-foreground/60"
          )}>
            {i < currentIndex && <Check className="h-3 w-3" />}
            {i === currentIndex && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {name}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- Main list ------------------------------------------------------------------

export function EventTaskList({
  eventId,
  clientId,
  eventDate,
  eventName,
  clientName,
  eventType,
  initialTasks,
  readinessByKind,
  templates,
  applications,
  contextLinksByTask,
  taskContacts,
  linkableDocuments,
  linkableTimelineEntries,
  linkableConversationMessages,
  requestsByTaskId = {},
  staffOptions = [],
}: {
  eventId: string;
  clientId: string | null;
  eventDate: string;
  eventName: string;
  clientName: string | null;
  eventType: string | null;
  initialTasks: EventTask[];
  readinessByKind: { client: EventReadiness | null; venue: EventReadiness | null };
  templates: PlaybookTemplateWithStats[];
  applications: EventPlaybookApplication[];
  contextLinksByTask: Record<string, EventTaskContextLink[]>;
  taskContacts: Record<string, TaskContact>;
  linkableDocuments: Document[];
  linkableTimelineEntries: TimelineEntry[];
  linkableConversationMessages: LinkableConversationMessage[];
  requestsByTaskId?: Record<string, Request>;
  staffOptions?: StaffOption[];
}) {
  const router = useRouter();
  // useSyncedState (not a plain useState(initialTasks)) — applying a
  // Playbook checklist (PlaybookApplyRow, below) writes real task rows and
  // calls router.refresh(); a plain useState would never look at the
  // refreshed initialTasks prop again once mounted. Same confirmed bug
  // shape as Timeline's entries state — see lib/hooks/use-synced-state.ts.
  const [tasks, setTasks] = useSyncedState(initialTasks);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  function handleUpdate(id: string, status: EventTask["status"]) {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, status } : t));
    router.refresh();
  }

  const clientTasks = tasks.filter((t) => t.ownerType === "couple");
  const overdue   = tasks.filter((t) => t.status === "overdue");
  const blocked   = tasks.filter((t) => t.status === "blocked");
  const pending   = tasks.filter((t) => t.status === "pending");
  const complete  = tasks.filter((t) => t.status === "complete");
  const waived    = tasks.filter((t) => t.status === "waived");

  const renderTaskRow = (task: EventTask) => {
    const kind: PlaybookKind = task.ownerType === "couple" ? "client" : "venue";
    return (
      <TaskRow
        key={task.id} task={task} kind={kind} eventId={eventId}
        clientId={clientId} clientName={clientName} request={requestsByTaskId[task.id] ?? null}
        expanded={expandedId === task.id}
        onToggleExpand={() => setExpandedId((p) => p === task.id ? null : task.id)}
        onUpdate={handleUpdate}
        contextLinks={contextLinksByTask[task.id] ?? []}
        contact={kind === "client" ? (taskContacts[task.assignedToStaffId ?? ""] ?? null) : null}
        documents={linkableDocuments} timelineEntries={linkableTimelineEntries} conversationMessages={linkableConversationMessages}
        staffOptions={staffOptions}
      />
    );
  };

  const renderGroup = (groupTasks: EventTask[], label: string, show: boolean) => !show || groupTasks.length === 0 ? null : (
    <div className="space-y-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground py-2">{label} ({groupTasks.length})</p>
      {groupTasks.map(renderTaskRow)}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Two independent planning systems — never merged into one status */}
      <div className="space-y-2">
        {PLAYBOOK_KINDS.map((k) => (
          <PlaybookApplyRow
            key={k.value}
            kind={k.value}
            eventId={eventId}
            clientId={clientId}
            eventDate={eventDate}
            eventName={eventName}
            clientName={clientName}
            eventType={eventType}
            templates={templates.filter((t) => t.kind === k.value)}
            application={applications.find((a) => a.kind === k.value)}
            readiness={k.value === "client" ? readinessByKind.client : readinessByKind.venue}
            onApplied={() => router.refresh()}
          />
        ))}
      </div>

      {clientTasks.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
          <MilestoneStepper tasks={clientTasks} />
        </div>
      )}

      {/* "Edit Draft" (in PlaybookApplyRow, above) scrolls here — a Draft
          Client Planning checklist is reviewed and edited in this same list,
          not a separate surface (Draft → Release workflow, 2026-07-10). */}
      <div id="planning-task-list">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Apply a Client Planning or Venue Planning checklist above to generate tasks automatically with real due dates.
          </p>
        ) : (
          <>
            {renderGroup(overdue,  "Overdue",  true)}
            {renderGroup(blocked,  "Waiting",  true)}
            {renderGroup(pending,  "Upcoming", true)}
            {renderGroup(complete, "Complete", true)}
            {renderGroup(waived,   "Waived",   waived.length > 0)}
          </>
        )}
      </div>
    </div>
  );
}
