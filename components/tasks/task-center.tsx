"use client";

/**
 * Task Center — the coordinator's operational command center.
 *
 * Design principle: "Coordinator manages exceptions, not steps."
 * The Task Center surfaces what needs human attention:
 *   Overdue → Blocked → Due Today → Due This Week → Upcoming
 *
 * Each section shows tasks grouped by event so coordinators immediately
 * understand which event is at risk, not just which tasks are late.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Check, ChevronRight, Clock, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { completeTaskAction, setTaskStatusAction } from "@/app/(app)/playbooks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { categoryColor, categoryLabel } from "@/lib/playbooks/constants";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  computedStatus: "overdue" | "blocked" | "pending" | "complete";
  due_date: string;
  category: string;
  owner_type: string;
  visibility: string;
  is_required: boolean;
  events: {
    id: string;
    name: string;
    event_date: string;
    clients: {
      first_name: string;
      last_name: string | null;
      partner_first_name: string | null;
    } | null;
  } | null;
};

const STATUS_ICON = {
  overdue:  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />,
  blocked:  <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
  pending:  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
  complete: <Check className="h-3.5 w-3.5 text-success shrink-0" />,
};

function formatDue(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const du = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (du < -1) return `${Math.abs(du)} days overdue`;
  if (du === -1) return "1 day overdue";
  if (du === 0) return "Today";
  if (du === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coupleName(clients: any): string {
  if (!clients) return "";
  return [clients.first_name, clients.partner_first_name].filter(Boolean).join(" & ");
}

function TaskItem({
  task, onComplete, onWaive, completing, waiving,
}: {
  task: TaskRow;
  onComplete: (id: string, eventId: string) => void;
  onWaive: (id: string, eventId: string) => void;
  completing: string | null;
  waiving: string | null;
}) {
  const isActing = completing === task.id || waiving === task.id;
  const eventId = task.events?.id ?? "";

  return (
    <div className="group flex items-start gap-3 py-3 last:border-0 border-b border-border/40">
      <div className="mt-0.5 shrink-0">{STATUS_ICON[task.computedStatus]}</div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-heading truncate">{task.title}</p>
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span style={{ color: categoryColor(task.category as import("@/lib/playbooks/types").TaskCategory) }}>
            {categoryLabel(task.category as import("@/lib/playbooks/types").TaskCategory)}
          </span>
          <span>·</span>
          <span className={task.computedStatus === "overdue" ? "text-destructive font-medium" : ""}>
            {formatDue(task.due_date)}
          </span>
          {task.owner_type !== "coordinator" && (
            <><span>·</span><span className="capitalize">{task.owner_type}</span></>
          )}
          {!task.is_required && <Badge variant="outline" className="text-[9px] h-4 px-1">optional</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {task.computedStatus !== "blocked" && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs"
            disabled={isActing} onClick={() => onComplete(task.id, eventId)}>
            {completing === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground"
          disabled={isActing} onClick={() => onWaive(task.id, eventId)}>
          Waive
        </Button>
        {eventId && (
          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0"
            render={<Link href={`/events/${eventId}`} />}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function EventGroup({ eventName, couple, eventId, tasks, onComplete, onWaive, completing, waiving }: {
  eventName: string;
  couple: string;
  eventId: string;
  tasks: TaskRow[];
  onComplete: (id: string, eventId: string) => void;
  onWaive: (id: string, eventId: string) => void;
  completing: string | null;
  waiving: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/50">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-heading truncate">{couple || eventName}</p>
          <p className="text-[10px] text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs shrink-0 text-muted-foreground"
          render={<Link href={`/events/${eventId}`} />}>
          View Event →
        </Button>
      </div>
      <div className="px-4">
        {tasks.map(t => (
          <TaskItem key={t.id} task={t} onComplete={onComplete} onWaive={onWaive} completing={completing} waiving={waiving} />
        ))}
      </div>
    </div>
  );
}

type SectionProps = {
  title: string;
  icon: React.ReactNode;
  tasks: TaskRow[];
  emptyMessage: string;
  priority?: "high" | "normal";
  onComplete: (id: string, eventId: string) => void;
  onWaive: (id: string, eventId: string) => void;
  completing: string | null;
  waiving: string | null;
  collapsed?: boolean;
};

function TaskSection({ title, icon, tasks, emptyMessage, priority, onComplete, onWaive, completing, waiving, collapsed = false }: SectionProps) {
  const [open, setOpen] = React.useState(!collapsed);

  // Group by event
  const byEvent = new Map<string, { name: string; couple: string; tasks: TaskRow[] }>();
  for (const t of tasks) {
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

  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 mb-3 w-full text-left group">
        {icon}
        <span className={`text-sm font-semibold ${priority === "high" ? "text-destructive" : "text-heading"}`}>{title}</span>
        <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
          priority === "high" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
        }`}>{tasks.length}</span>
        <span className="text-xs text-muted-foreground ml-auto group-hover:text-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-5 pb-2">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {[...byEvent.entries()].map(([eventId, group]) => (
              <EventGroup key={eventId} eventId={eventId} eventName={group.name} couple={group.couple}
                tasks={group.tasks} onComplete={onComplete} onWaive={onWaive} completing={completing} waiving={waiving} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

export function TaskCenter({ overdue, dueToday, dueThisWeek, blocked, upcoming, venueId }: {
  overdue: TaskRow[];
  dueToday: TaskRow[];
  dueThisWeek: TaskRow[];
  blocked: TaskRow[];
  upcoming: TaskRow[];
  venueId: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState({ overdue, dueToday, dueThisWeek, blocked, upcoming });
  const [completing, setCompleting] = React.useState<string | null>(null);
  const [waiving, setWaiving] = React.useState<string | null>(null);

  function removeTask(id: string) {
    setTasks(prev => ({
      overdue:    prev.overdue.filter(t => t.id !== id),
      dueToday:   prev.dueToday.filter(t => t.id !== id),
      dueThisWeek: prev.dueThisWeek.filter(t => t.id !== id),
      blocked:    prev.blocked.filter(t => t.id !== id),
      upcoming:   prev.upcoming.filter(t => t.id !== id),
    }));
  }

  async function handleComplete(taskId: string, eventId: string) {
    setCompleting(taskId);
    const result = await completeTaskAction(taskId, eventId);
    setCompleting(null);
    if (result.ok) { removeTask(taskId); toast.success("Task complete."); router.refresh(); }
    else toast.error(result.message ?? "Could not complete task.");
  }

  async function handleWaive(taskId: string, eventId: string) {
    setWaiving(taskId);
    const result = await setTaskStatusAction(taskId, eventId, "waived");
    setWaiving(null);
    if (result.ok) { removeTask(taskId); }
    else toast.error("Could not waive task.");
  }

  const totalExceptions = tasks.overdue.length + tasks.dueToday.length + tasks.blocked.length;

  return (
    <div className="space-y-6">
      {totalExceptions === 0 && tasks.dueThisWeek.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center space-y-2">
          <p className="text-2xl">✅</p>
          <p className="text-sm font-medium text-heading">No tasks need attention right now</p>
          <p className="text-xs text-muted-foreground">All upcoming events are on track. Check back tomorrow.</p>
        </div>
      ) : (
        <>
          {/* Exception band */}
          {totalExceptions > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {totalExceptions} item{totalExceptions !== 1 ? "s" : ""} need your attention today
              </p>
            </div>
          )}

          <TaskSection
            title="Overdue" icon={<AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
            tasks={tasks.overdue} emptyMessage="No overdue tasks."
            priority="high" onComplete={handleComplete} onWaive={handleWaive}
            completing={completing} waiving={waiving}
          />
          <TaskSection
            title="Blocked" icon={<Lock className="h-4 w-4 text-amber-500 shrink-0" />}
            tasks={tasks.blocked} emptyMessage="No blocked tasks."
            onComplete={handleComplete} onWaive={handleWaive}
            completing={completing} waiving={waiving}
          />
          <TaskSection
            title="Due today" icon={<CalendarDays className="h-4 w-4 text-heading shrink-0" />}
            tasks={tasks.dueToday} emptyMessage="Nothing due today."
            onComplete={handleComplete} onWaive={handleWaive}
            completing={completing} waiving={waiving}
          />
          <TaskSection
            title="Due this week" icon={<Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
            tasks={tasks.dueThisWeek} emptyMessage="Nothing due this week."
            onComplete={handleComplete} onWaive={handleWaive}
            completing={completing} waiving={waiving}
          />
          {tasks.upcoming.length > 0 && (
            <TaskSection
              title="Upcoming" icon={<CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />}
              tasks={tasks.upcoming} emptyMessage=""
              onComplete={handleComplete} onWaive={handleWaive}
              completing={completing} waiving={waiving}
              collapsed={true}
            />
          )}
        </>
      )}
    </div>
  );
}
