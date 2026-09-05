"use client";

/**
 * Task Center — venue operational workspace.
 *
 * DO    = work the venue/team needs to do (exceptions first, Upcoming always discoverable)
 * WATCH = meaningful released client progress (not a complete checklist dump)
 * INVESTIGATE = Find a client/event → filter or open event Planning
 *
 * My Work / By Person / All Team Work are lenses over DO only.
 * WATCH stays visible regardless of lens.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CalendarDays, Check, ChevronRight, Clock, Eye, Lock, Loader2, Search,
} from "lucide-react";
import { toast } from "sonner";

import { completeTaskAction, setTaskStatusAction } from "@/app/(app)/playbooks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryColor, categoryLabel, formatEventRelativeDue } from "@/lib/playbooks/constants";
import {
  matchEventsForFind,
  UPCOMING_DO_PREVIEW,
  type SearchableEvent,
} from "@/lib/tasks/task-center";
import { cn } from "@/lib/utils";

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  computedStatus: "overdue" | "blocked" | "pending" | "complete";
  due_date: string;
  days_offset: number | null;
  due_date_locked: boolean;
  category: string;
  owner_type: string;
  visibility: string;
  is_required: boolean;
  auto_complete_trigger: string | null;
  assigned_to_staff_id: string | null;
  assignee: { full_name: string } | null;
  milestone_kind: string | null;
  events: {
    id: string;
    name: string;
    event_date: string;
    clients: {
      first_name: string;
      last_name: string | null;
      partner_first_name: string | null;
      partner_last_name?: string | null;
    } | null;
  } | null;
};

type Perspective = "my-work" | "by-person" | "all-team";

const PERSPECTIVES: { id: Perspective; label: string }[] = [
  { id: "my-work", label: "My Work" },
  { id: "by-person", label: "By Person" },
  { id: "all-team", label: "All Team Work" },
];

const STATUS_ICON = {
  overdue:  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" aria-hidden />,
  blocked:  <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden />,
  pending:  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />,
  complete: <Check className="h-3.5 w-3.5 text-success shrink-0" aria-hidden />,
};

function formatDue(task: TaskRow): string {
  return formatEventRelativeDue({
    daysOffset: task.days_offset,
    dueDate: task.due_date,
    dueDateLocked: task.due_date_locked,
    style: "urgency",
  });
}

function coupleName(clients: TaskRow["events"] extends infer E
  ? E extends { clients: infer C } ? C : null
  : null): string {
  if (!clients) return "";
  return [clients.first_name, clients.partner_first_name].filter(Boolean).join(" & ");
}

function eventMeta(task: TaskRow): { eventId: string; couple: string; eventName: string; eventDate: string } {
  const eventId = task.events?.id ?? "";
  const eventName = task.events?.name ?? "Event";
  const couple = coupleName(task.events?.clients ?? null);
  const eventDate = task.events?.event_date
    ? new Date(task.events.event_date + "T00:00:00").toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";
  return { eventId, couple, eventName, eventDate };
}

function DoTaskItem({
  task, onComplete, onWaive, completing, waiving,
}: {
  task: TaskRow;
  onComplete: (id: string, eventId: string) => void;
  onWaive: (id: string, eventId: string) => void;
  completing: string | null;
  waiving: string | null;
}) {
  const isActing = completing === task.id || waiving === task.id;
  const { eventId, couple, eventDate } = eventMeta(task);

  return (
    <div className="group flex items-start gap-3 py-3 last:border-0 border-b border-border/40">
      <div className="mt-0.5 shrink-0">{STATUS_ICON[task.computedStatus]}</div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-heading truncate">{task.title}</p>
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {(couple || eventDate) && (
            <span className="truncate max-w-[14rem] text-heading/80">
              {[couple, eventDate].filter(Boolean).join(" · ")}
            </span>
          )}
          <span aria-hidden>·</span>
          <span style={{ color: categoryColor(task.category as import("@/lib/playbooks/types").TaskCategory) }}>
            {categoryLabel(task.category as import("@/lib/playbooks/types").TaskCategory)}
          </span>
          <span aria-hidden>·</span>
          <span className={task.computedStatus === "overdue" ? "text-destructive font-medium" : ""}>
            {formatDue(task)}
          </span>
          {task.owner_type === "vendor" && (
            <><span aria-hidden>·</span><span>Vendor</span></>
          )}
          {task.owner_type === "team" && (
            <><span aria-hidden>·</span><span>Team</span></>
          )}
          {task.assignee ? (
            <><span aria-hidden>·</span><span>{task.assignee.full_name}</span></>
          ) : (
            <><span aria-hidden>·</span><span className="italic">Unassigned</span></>
          )}
          {!task.is_required && <Badge variant="outline" className="text-[9px] h-4 px-1">optional</Badge>}
          {task.milestone_kind === "event_day" && (
            <Badge className="text-[9px] h-4 px-1.5 border-transparent bg-primary text-primary-foreground">
              Event day
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        {task.computedStatus !== "blocked" && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs"
            disabled={isActing} onClick={() => onComplete(task.id, eventId)}
            aria-label={`Mark complete: ${task.title}`}>
            {completing === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground"
          disabled={isActing} onClick={() => onWaive(task.id, eventId)}
          aria-label={`Waive: ${task.title}`}>
          Waive
        </Button>
        {eventId && (
          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0"
            render={<Link href={`/events/${eventId}`} />}
            aria-label={`Open event for ${couple || task.title}`}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function WatchTaskItem({ task }: { task: TaskRow }) {
  const { eventId, couple, eventDate } = eventMeta(task);
  const reason =
    task.computedStatus === "overdue" ? "Overdue — client may be falling behind"
    : task.computedStatus === "blocked" ? "Waiting on another step"
    : "Coming up soon for this couple";

  return (
    <div className="flex items-start gap-3 py-3 last:border-0 border-b border-border/40">
      <div className="mt-0.5 shrink-0" aria-hidden>
        {task.computedStatus === "overdue"
          ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-heading truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[couple, eventDate].filter(Boolean).join(" · ")}
          <span aria-hidden> · </span>
          <span className={task.computedStatus === "overdue" ? "text-destructive font-medium" : ""}>
            {formatDue(task)}
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground">{reason}</p>
      </div>
      {eventId && (
        <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs shrink-0"
          render={<Link href={`/events/${eventId}`} />}>
          View client progress
        </Button>
      )}
    </div>
  );
}

function EventGroup({
  eventName, couple, eventId, tasks, mode, onComplete, onWaive, completing, waiving,
}: {
  eventName: string;
  couple: string;
  eventId: string;
  tasks: TaskRow[];
  mode: "do" | "watch";
  onComplete?: (id: string, eventId: string) => void;
  onWaive?: (id: string, eventId: string) => void;
  completing?: string | null;
  waiving?: string | null;
}) {
  return (
    <div className={cn(
      "rounded-sm border bg-card",
      mode === "watch" ? "border-border/80 border-l-[3px] border-l-sky-600/70" : "border-border",
    )}>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/50">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-heading truncate">{couple || eventName}</p>
          <p className="text-[10px] text-muted-foreground">
            {tasks.length} {mode === "watch" ? "to watch" : `task${tasks.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs shrink-0 text-muted-foreground"
          render={<Link href={`/events/${eventId}`} />}>
          View event →
        </Button>
      </div>
      <div className="px-4">
        {mode === "watch"
          ? tasks.map((t) => <WatchTaskItem key={t.id} task={t} />)
          : tasks.map((t) => (
              <DoTaskItem
                key={t.id} task={t}
                onComplete={onComplete!} onWaive={onWaive!}
                completing={completing ?? null} waiving={waiving ?? null}
              />
            ))}
      </div>
    </div>
  );
}

function StaffGroup({
  staffName, tasks, onComplete, onWaive, completing, waiving,
}: {
  staffName: string;
  tasks: TaskRow[];
  onComplete: (id: string, eventId: string) => void;
  onWaive: (id: string, eventId: string) => void;
  completing: string | null;
  waiving: string | null;
}) {
  return (
    <div className="rounded-sm border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
        <p className="text-xs font-semibold text-heading truncate">{staffName}</p>
        <p className="text-[10px] text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</p>
      </div>
      <div className="px-4">
        {tasks.map((t) => (
          <DoTaskItem key={t.id} task={t} onComplete={onComplete} onWaive={onWaive}
            completing={completing} waiving={waiving} />
        ))}
      </div>
    </div>
  );
}

function DoSection({
  title, icon, tasks, priority, onComplete, onWaive, completing, waiving,
  collapsed = false, groupBy = "event", previewLimit,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: TaskRow[];
  priority?: "high" | "normal";
  onComplete: (id: string, eventId: string) => void;
  onWaive: (id: string, eventId: string) => void;
  completing: string | null;
  waiving: string | null;
  collapsed?: boolean;
  groupBy?: "event" | "staff";
  previewLimit?: number;
}) {
  const [open, setOpen] = React.useState(!collapsed);
  const [showAll, setShowAll] = React.useState(false);
  const visible = previewLimit && !showAll ? tasks.slice(0, previewLimit) : tasks;
  const hiddenCount = tasks.length - visible.length;

  const byEvent = new Map<string, { name: string; couple: string; tasks: TaskRow[] }>();
  const byStaff = new Map<string, { name: string; tasks: TaskRow[] }>();
  for (const t of visible) {
    if (groupBy === "staff") {
      const staffId = t.assigned_to_staff_id ?? "unassigned";
      if (!byStaff.has(staffId)) {
        byStaff.set(staffId, { name: t.assignee?.full_name ?? "Unassigned", tasks: [] });
      }
      byStaff.get(staffId)!.tasks.push(t);
    } else {
      const eventId = t.events?.id ?? "no-event";
      if (!byEvent.has(eventId)) {
        byEvent.set(eventId, {
          name: t.events?.name ?? "Unknown event",
          couple: coupleName(t.events?.clients ?? null),
          tasks: [],
        });
      }
      byEvent.get(eventId)!.tasks.push(t);
    }
  }

  // Unassigned first when grouping by person
  const staffEntries = [...byStaff.entries()].sort(([a], [b]) => {
    if (a === "unassigned") return -1;
    if (b === "unassigned") return 1;
    return 0;
  });

  // Hide empty urgency bands — only Upcoming is gated by the caller; other
  // bands omit themselves when empty so the page stays quiet.
  if (tasks.length === 0) return null;

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 mb-3 w-full text-left group"
        aria-expanded={open}>
        {icon}
        <span className={`text-sm font-semibold ${priority === "high" ? "text-destructive" : "text-heading"}`}>{title}</span>
        <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
          priority === "high" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
        }`}>{tasks.length}</span>
        <span className="text-xs text-muted-foreground ml-auto group-hover:text-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-3">
          {groupBy === "staff"
            ? staffEntries.map(([staffId, group]) => (
                <StaffGroup key={staffId} staffName={group.name}
                  tasks={group.tasks} onComplete={onComplete} onWaive={onWaive}
                  completing={completing} waiving={waiving} />
              ))
            : [...byEvent.entries()].map(([eventId, group]) => (
                <EventGroup key={eventId} eventId={eventId} eventName={group.name} couple={group.couple}
                  tasks={group.tasks} mode="do"
                  onComplete={onComplete} onWaive={onWaive}
                  completing={completing} waiving={waiving} />
              ))}
          {hiddenCount > 0 && (
            <Button type="button" variant="ghost" size="sm" className="text-xs"
              onClick={() => setShowAll(true)}>
              Show all {tasks.length} upcoming
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskCenter({
  doOverdue, doBlocked, doDueToday, doDueSoon, doUpcoming,
  watchTasks,
  searchableEvents,
  hasAnyDoTasks,
  currentStaffId = null,
  currentRole = null,
}: {
  doOverdue: TaskRow[];
  doBlocked: TaskRow[];
  doDueToday: TaskRow[];
  doDueSoon: TaskRow[];
  doUpcoming: TaskRow[];
  watchTasks: TaskRow[];
  searchableEvents: SearchableEvent[];
  /** Venue has at least one open DO task (any urgency). */
  hasAnyDoTasks: boolean;
  currentStaffId?: string | null;
  currentRole?: string | null;
}) {
  const router = useRouter();
  const [removedIds, setRemovedIds] = React.useState(() => new Set<string>());
  const [completing, setCompleting] = React.useState<string | null>(null);
  const [waiving, setWaiving] = React.useState<string | null>(null);
  const [perspective, setPerspective] = React.useState<Perspective>(
    currentRole === "owner" || currentRole === "manager" || !currentStaffId ? "all-team" : "my-work",
  );
  const [findQuery, setFindQuery] = React.useState("");
  const [eventFilterId, setEventFilterId] = React.useState<string | null>(null);
  const [findMenuOpen, setFindMenuOpen] = React.useState(false);

  const findMatches = React.useMemo(
    () => matchEventsForFind(searchableEvents, findQuery),
    [searchableEvents, findQuery],
  );

  function selectFindEvent(ev: SearchableEvent) {
    setEventFilterId(ev.id);
    setFindQuery(ev.coupleLabel || ev.name);
    setFindMenuOpen(false);
    const el = document.getElementById("task-center-find") as HTMLInputElement | null;
    el?.blur();
  }

  function clearFind() {
    setEventFilterId(null);
    setFindQuery("");
    setFindMenuOpen(false);
  }

  const filterByEvent = React.useCallback(
    (rows: TaskRow[]) => {
      if (!eventFilterId) return rows;
      return rows.filter((t) => t.events?.id === eventFilterId);
    },
    [eventFilterId],
  );

  const notRemoved = React.useCallback(
    (rows: TaskRow[]) => rows.filter((t) => !removedIds.has(t.id)),
    [removedIds],
  );

  const doBuckets = React.useMemo(() => ({
    overdue: notRemoved(doOverdue),
    blocked: notRemoved(doBlocked),
    dueToday: notRemoved(doDueToday),
    dueSoon: notRemoved(doDueSoon),
    upcoming: notRemoved(doUpcoming),
  }), [doOverdue, doBlocked, doDueToday, doDueSoon, doUpcoming, notRemoved]);

  const scopedDo = React.useMemo(() => {
    const applyLens = (rows: TaskRow[]) => {
      let next = filterByEvent(rows);
      if (perspective === "my-work" && currentStaffId) {
        next = next.filter((t) => t.assigned_to_staff_id === currentStaffId);
      }
      return next;
    };
    return {
      overdue: applyLens(doBuckets.overdue),
      blocked: applyLens(doBuckets.blocked),
      dueToday: applyLens(doBuckets.dueToday),
      dueSoon: applyLens(doBuckets.dueSoon),
      upcoming: applyLens(doBuckets.upcoming),
    };
  }, [doBuckets, perspective, currentStaffId, filterByEvent]);

  const scopedWatch = React.useMemo(
    () => filterByEvent(notRemoved(watchTasks)),
    [watchTasks, filterByEvent, notRemoved],
  );

  const groupBy: "event" | "staff" = perspective === "by-person" ? "staff" : "event";

  function removeDoTask(id: string) {
    setRemovedIds((prev) => new Set(prev).add(id));
  }

  async function handleComplete(taskId: string, eventId: string) {
    setCompleting(taskId);
    const result = await completeTaskAction(taskId, eventId);
    setCompleting(null);
    if (result.ok) { removeDoTask(taskId); toast.success("Task complete."); router.refresh(); }
    else toast.error(result.message ?? "Could not complete task.");
  }

  async function handleWaive(taskId: string, eventId: string) {
    setWaiving(taskId);
    const result = await setTaskStatusAction(taskId, eventId, "waived");
    setWaiving(null);
    if (result.ok) { removeDoTask(taskId); }
    else toast.error("Could not waive task.");
  }

  const doImmediate =
    scopedDo.overdue.length + scopedDo.blocked.length + scopedDo.dueToday.length + scopedDo.dueSoon.length;
  const doUpcomingCount = scopedDo.upcoming.length;
  const doTotalAll =
    doBuckets.overdue.length + doBuckets.blocked.length + doBuckets.dueToday.length
    + doBuckets.dueSoon.length + doBuckets.upcoming.length;

  const myWorkEmpty =
    perspective === "my-work"
    && doImmediate === 0
    && doUpcomingCount === 0
    && doTotalAll > 0;

  const filteredEvent = eventFilterId
    ? searchableEvents.find((e) => e.id === eventFilterId) ?? null
    : null;

  const watchByEvent = new Map<string, { name: string; couple: string; tasks: TaskRow[] }>();
  for (const t of scopedWatch) {
    const eventId = t.events?.id ?? "no-event";
    if (!watchByEvent.has(eventId)) {
      watchByEvent.set(eventId, {
        name: t.events?.name ?? "Unknown event",
        couple: coupleName(t.events?.clients ?? null),
        tasks: [],
      });
    }
    watchByEvent.get(eventId)!.tasks.push(t);
  }

  return (
    <div className="space-y-8">
      {/* INVESTIGATE */}
      <div className="space-y-2">
        <label htmlFor="task-center-find" className="text-xs font-medium text-heading">
          Find a client or event
        </label>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="task-center-find"
            type="search"
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              setFindMenuOpen(true);
              if (!e.target.value.trim()) setEventFilterId(null);
            }}
            onFocus={() => {
              // Re-open matches when editing; stay closed after a completed selection.
              if (!eventFilterId && findQuery.trim()) setFindMenuOpen(true);
            }}
            onBlur={() => {
              // Delay so a mousedown on a result can fire first.
              window.setTimeout(() => setFindMenuOpen(false), 150);
            }}
            placeholder="Search by couple or event name…"
            className="pl-8 h-9"
            autoComplete="off"
            aria-expanded={findMenuOpen}
            aria-controls="task-center-find-results"
            aria-autocomplete="list"
          />
        </div>
        {findMenuOpen && findQuery.trim() && (
          <div
            id="task-center-find-results"
            className="max-w-md rounded-sm border border-border bg-card"
            role="listbox"
            aria-label="Matching events"
          >
            {findMatches.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">No events match.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {findMatches.slice(0, 8).map((ev) => (
                  <li key={ev.id} className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectFindEvent(ev)}
                    >
                      <p className="text-sm font-medium text-heading truncate">{ev.coupleLabel || ev.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {ev.name}
                        {ev.eventDate
                          ? ` · ${new Date(ev.eventDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                          : ""}
                      </p>
                    </button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs shrink-0"
                      onMouseDown={(e) => e.preventDefault()}
                      render={<Link href={`/events/${ev.id}`} />}>
                      Open planning
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {filteredEvent && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-1 text-heading">
              Showing: {filteredEvent.coupleLabel || filteredEvent.name}
            </span>
            <button
              type="button"
              className="text-muted-foreground underline-offset-2 hover:underline"
              onClick={clearFind}
            >
              Clear
            </button>
            <Link href={`/events/${filteredEvent.id}`} className="text-primary underline-offset-2 hover:underline">
              Full event planning →
            </Link>
          </div>
        )}
      </div>

      {/* Lenses — DO only */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Team work view">
        {PERSPECTIVES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={perspective === p.id}
            onClick={() => setPerspective(p.id)}
            disabled={p.id === "my-work" && !currentStaffId}
            title={p.id === "my-work" && !currentStaffId ? "No active staff record found for your account." : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
              perspective === p.id
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-ring",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* DO */}
      <section aria-labelledby="task-center-do-heading" className="space-y-4">
        <div>
          <h2 id="task-center-do-heading" className="text-sm font-semibold text-heading tracking-wide uppercase">
            Your team&apos;s work
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tasks your venue needs to complete across events.
          </p>
        </div>

        {myWorkEmpty && (
          <div className="rounded-sm border border-dashed border-border px-4 py-6 text-center space-y-2">
            <p className="text-sm font-medium text-heading">Nothing assigned to you</p>
            <p className="text-xs text-muted-foreground">
              Your teammates still have work. Switch to{" "}
              <button type="button" className="underline underline-offset-2" onClick={() => setPerspective("by-person")}>
                By Person
              </button>
              {" "}or{" "}
              <button type="button" className="underline underline-offset-2" onClick={() => setPerspective("all-team")}>
                All Team Work
              </button>
              .
            </p>
          </div>
        )}

        {!hasAnyDoTasks && !eventFilterId && (
          <div className="rounded-sm border border-dashed border-border px-4 py-10 text-center space-y-2">
            <p className="text-sm font-medium text-heading">No team tasks yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Apply Venue Planning on an event to build your team&apos;s task list.
            </p>
          </div>
        )}

        {hasAnyDoTasks && doImmediate === 0 && doUpcomingCount > 0 && !myWorkEmpty && (
          <div className="rounded-sm border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium text-heading">Nothing on your plate today</p>
            <p className="text-xs text-muted-foreground">Here&apos;s what&apos;s coming up across your events.</p>
          </div>
        )}

        {doImmediate > 0 && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />
            <p className="text-sm font-medium text-destructive">
              {doImmediate} item{doImmediate !== 1 ? "s" : ""} need attention on your team&apos;s list
            </p>
          </div>
        )}

        {(hasAnyDoTasks || eventFilterId) && !myWorkEmpty && (
          <>
            <DoSection
              title="Overdue" icon={<AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />}
              tasks={scopedDo.overdue}
              priority="high" onComplete={handleComplete} onWaive={handleWaive}
              completing={completing} waiving={waiving} groupBy={groupBy}
            />
            <DoSection
              title="Blocked" icon={<Lock className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />}
              tasks={scopedDo.blocked}
              onComplete={handleComplete} onWaive={handleWaive}
              completing={completing} waiving={waiving} groupBy={groupBy}
            />
            <DoSection
              title="Due today" icon={<CalendarDays className="h-4 w-4 text-heading shrink-0" aria-hidden />}
              tasks={scopedDo.dueToday}
              onComplete={handleComplete} onWaive={handleWaive}
              completing={completing} waiving={waiving} groupBy={groupBy}
            />
            <DoSection
              title="Due soon" icon={<Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />}
              tasks={scopedDo.dueSoon}
              onComplete={handleComplete} onWaive={handleWaive}
              completing={completing} waiving={waiving} groupBy={groupBy}
            />
            {scopedDo.upcoming.length > 0 && (
              <DoSection
                title="Upcoming" icon={<CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />}
                tasks={scopedDo.upcoming}
                onComplete={handleComplete} onWaive={handleWaive}
                completing={completing} waiving={waiving} groupBy={groupBy}
                collapsed={doImmediate > 0}
                previewLimit={UPCOMING_DO_PREVIEW}
              />
            )}
          </>
        )}
      </section>

      {/* WATCH — always its own zone; not affected by My Work lens */}
      <section aria-labelledby="task-center-watch-heading" className="space-y-3">
        <div className="flex items-start gap-2">
          <Eye className="h-4 w-4 text-sky-700 mt-0.5 shrink-0" aria-hidden />
          <div>
            <h2 id="task-center-watch-heading" className="text-sm font-semibold text-heading tracking-wide uppercase">
              Client progress
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Couples who may need a nudge — open the event to see the full picture.
            </p>
          </div>
        </div>

        {scopedWatch.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-6">No client tasks need watching right now.</p>
        ) : (
          <>
            {doImmediate === 0 && doUpcomingCount === 0 && (
              <div className="rounded-sm border border-sky-700/20 bg-sky-50/50 dark:bg-sky-950/20 px-4 py-3">
                <p className="text-sm font-medium text-heading">Your team&apos;s clear — a few clients need watching</p>
              </div>
            )}
            <div className="space-y-3">
              {[...watchByEvent.entries()].map(([eventId, group]) => (
                <EventGroup
                  key={eventId}
                  eventId={eventId}
                  eventName={group.name}
                  couple={group.couple}
                  tasks={group.tasks}
                  mode="watch"
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
