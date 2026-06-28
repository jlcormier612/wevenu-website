"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Check, Lock, AlertTriangle, Clock, Minus, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { applyPlaybookAction, completeTaskAction, setTaskStatusAction } from "@/app/(app)/playbooks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { categoryColor, categoryLabel, formatDaysOffset, STATUS_CONFIG } from "@/lib/playbooks/constants";
import type { EventTask, EventReadiness } from "@/lib/playbooks/types";
import type { PlaybookTemplate } from "@/lib/playbooks/types";

const STATUS_ICONS = {
  complete: Check,
  pending:  Clock,
  blocked:  Lock,
  overdue:  AlertTriangle,
  waived:   Minus,
};

function TaskRow({ task, eventId, onUpdate }: { task: EventTask; eventId: string; onUpdate: (id: string, status: EventTask["status"]) => void }) {
  const [pending, startAction] = React.useTransition();
  const cfg = STATUS_CONFIG[task.status];
  const Icon = STATUS_ICONS[task.status];
  const isComplete = task.status === "complete";
  const isBlocked = task.status === "blocked";

  function handleComplete() {
    startAction(async () => {
      const result = await completeTaskAction(task.id, eventId);
      if (result.ok) { onUpdate(task.id, "complete"); toast.success("Task marked complete."); }
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

  return (
    <div className={`group flex items-start gap-3 py-3 border-b border-border/50 last:border-0 ${isBlocked ? "opacity-70" : ""}`}>
      {/* Status icon */}
      <div className="shrink-0 mt-0.5">
        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
      </div>

      {/* Task info */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={`text-sm font-medium ${isComplete ? "text-muted-foreground line-through" : "text-heading"}`}>
          {task.title}
          {!task.isRequired && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground uppercase tracking-wide">optional</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span style={{ color: categoryColor(task.category) }}>{categoryLabel(task.category)}</span>
          <span>·</span>
          <span>{task.ownerType === "couple" ? "Couple" : task.ownerType === "vendor" ? "Vendor" : "Coordinator"}</span>
          <span>·</span>
          <span>{new Date(task.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
        {isBlocked && task.dependsOnTitle && (
          <p className="text-xs text-warning-foreground">
            <Lock className="inline h-3 w-3 mr-0.5" /> Waiting on: {task.dependsOnTitle}
          </p>
        )}
        {task.autoCompleteTrigger && !isComplete && (
          <p className="text-[10px] text-muted-foreground italic">Auto-completes on trigger</p>
        )}
      </div>

      {/* Actions */}
      {!isComplete && !isBlocked && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button type="button" size="sm" variant="outline" onClick={handleComplete} disabled={pending} className="h-7 px-2 text-xs">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={handleWaive} disabled={pending} className="h-7 px-2 text-xs text-muted-foreground">
            {task.status === "waived" ? "Restore" : "Waive"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function EventTaskList({
  eventId,
  eventDate,
  initialTasks,
  readiness,
  templates,
}: {
  eventId: string;
  eventDate: string;
  initialTasks: EventTask[];
  readiness: EventReadiness | null;
  templates: PlaybookTemplate[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState(initialTasks);
  const [applying, startApply] = React.useTransition();
  const [selectedTemplate, setSelectedTemplate] = React.useState(templates[0]?.id ?? "");

  function handleUpdate(id: string, status: EventTask["status"]) {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, status } : t));
    router.refresh();
  }

  async function handleApply() {
    if (!selectedTemplate) return;
    startApply(async () => {
      const result = await applyPlaybookAction(eventId, selectedTemplate, eventDate);
      if (result.ok) { toast.success("Playbook applied — tasks generated."); router.refresh(); }
      else toast.error(result.message ?? "Could not apply playbook.");
    });
  }

  const overdue   = tasks.filter((t) => t.status === "overdue");
  const blocked   = tasks.filter((t) => t.status === "blocked");
  const pending   = tasks.filter((t) => t.status === "pending");
  const complete  = tasks.filter((t) => t.status === "complete");
  const waived    = tasks.filter((t) => t.status === "waived");

  if (tasks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-border py-12 text-center space-y-3">
          <p className="text-sm font-medium text-heading">No playbook applied yet</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Apply a playbook template to generate all event tasks automatically with real due dates.
          </p>
          {templates.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="h-8 w-48 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" size="sm" onClick={handleApply} disabled={applying}>
                {applying ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Applying…</> : <><Plus className="mr-1 h-3.5 w-3.5" />Apply Playbook</>}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderGroup = (groupTasks: EventTask[], label: string, show: boolean) => !show || groupTasks.length === 0 ? null : (
    <div className="space-y-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground py-2">{label} ({groupTasks.length})</p>
      {groupTasks.map((t) => <TaskRow key={t.id} task={t} eventId={eventId} onUpdate={handleUpdate} />)}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Readiness summary */}
      {readiness && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-heading">Event Readiness</p>
            <p className="text-xs text-muted-foreground">
              {readiness.completedRequired} of {readiness.totalRequired} required tasks complete
              {readiness.blockedCount > 0 && ` · ${readiness.blockedCount} blocked`}
              {readiness.overdueCount > 0 && ` · ${readiness.overdueCount} overdue`}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-xl font-bold ${readiness.score >= 80 ? "text-success" : readiness.score >= 50 ? "text-heading" : "text-destructive"}`}>
              {readiness.score}%
            </p>
          </div>
        </div>
      )}

      {renderGroup(overdue,  "Overdue",  true)}
      {renderGroup(blocked,  "Blocked",  true)}
      {renderGroup(pending,  "Upcoming", true)}
      {renderGroup(complete, "Complete", true)}
      {renderGroup(waived,   "Waived",   waived.length > 0)}
    </div>
  );
}
