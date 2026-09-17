"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Calendar, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addTaskAction,
  deleteTaskAction,
  setTaskCompletedAction,
  updateTaskAction,
} from "@/app/(app)/leads/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import { formatDate, isOverdue, isDueToday } from "@/lib/leads/constants";
import { partitionByCompletion } from "@/lib/tasks/group-by-completion";
import type { LeadTask } from "@/lib/leads/types";
import { cn } from "@/lib/utils";

export type StaffOption = { id: string; name: string };

function TaskRow({
  task,
  staffOptions,
  onToggle,
  onDelete,
  onUpdate,
}: {
  task: LeadTask;
  staffOptions: StaffOption[];
  onToggle: (id: string, completed: boolean, title: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, title: string, dueDate: string, assignedToStaffId: string | null) => void;
}) {
  const [editMode, setEditMode] = React.useState(false);
  const [title, setTitle] = React.useState(task.title);
  const [dueDate, setDueDate] = React.useState(task.dueDate ?? "");
  const [assigneeId, setAssigneeId] = React.useState(task.assignedToStaffId ?? "");

  function saveEdit() {
    if (!title.trim()) return;
    onUpdate(task.id, title, dueDate, assigneeId || null);
    setEditMode(false);
  }

  const overdue = !task.completed && isOverdue(task.dueDate);
  const dueToday = !task.completed && !overdue && isDueToday(task.dueDate);

  if (editMode) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-ring bg-card p-2.5 sm:flex-row sm:items-center">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 h-8 text-sm"
          autoFocus
          aria-label="Task title"
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") {
              setTitle(task.title);
              setDueDate(task.dueDate ?? "");
              setAssigneeId(task.assignedToStaffId ?? "");
              setEditMode(false);
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-36 h-8 shrink-0 text-sm"
            aria-label="Due date"
          />
          <Select
            value={assigneeId || "__unassigned__"}
            onValueChange={(v) => setAssigneeId(v === "__unassigned__" ? "" : v)}
            items={[
              { value: "__unassigned__", label: "Unassigned" },
              ...staffOptions.map((s) => ({ value: s.id, label: s.name })),
            ]}
          >
            <SelectTrigger className="h-8 w-40 text-sm" aria-label="Assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" disabled={!title.trim()} onClick={saveEdit}>
            <Check className="mr-1 h-3.5 w-3.5" />Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setTitle(task.title);
              setDueDate(task.dueDate ?? "");
              setAssigneeId(task.assignedToStaffId ?? "");
              setEditMode(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <button
        type="button"
        onClick={() => onToggle(task.id, task.completed, task.title)}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          task.completed
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:border-primary",
        )}
      >
        {task.completed && <Check className="h-3 w-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm cursor-pointer truncate",
            task.completed ? "text-muted-foreground line-through" : "text-foreground",
          )}
          onClick={() => !task.completed && setEditMode(true)}
        >
          {task.title}
        </span>
        {task.assigneeName && (
          <span className="text-xs text-muted-foreground">{task.assigneeName}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task.dueDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              overdue ? "font-medium text-destructive" : dueToday ? "font-medium text-warning-foreground" : "text-muted-foreground",
            )}
          >
            <Calendar className="h-3 w-3" />
            {overdue ? "Overdue · " : dueToday ? "Today · " : ""}
            {formatDate(task.dueDate)}
          </span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {!task.completed && (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Edit task"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function TasksSection({
  leadId,
  initialTasks,
  staffOptions,
  defaultAssigneeId,
}: {
  leadId: string;
  initialTasks: LeadTask[];
  staffOptions: StaffOption[];
  defaultAssigneeId?: string | null;
}) {
  const router = useRouter();
  // See lib/hooks/use-synced-state.ts — DateHoldsSection is a true sibling
  // on this same tab and calls router.refresh() on its own hold create/
  // release, which would otherwise leave this list stale without a full
  // reload.
  const [tasks, setTasks] = useSyncedState(initialTasks);
  const [titleInput, setTitleInput] = React.useState("");
  const [dueDateInput, setDueDateInput] = React.useState("");
  const [assigneeInput, setAssigneeInput] = React.useState(defaultAssigneeId ?? "");
  const [addPending, startAdd] = React.useTransition();

  function handleAdd() {
    if (!titleInput.trim()) return;
    const assignedToStaffId = assigneeInput || null;
    const assigneeName = staffOptions.find((s) => s.id === assignedToStaffId)?.name ?? null;
    startAdd(async () => {
      const result = await addTaskAction(leadId, {
        title: titleInput,
        dueDate: dueDateInput,
        assignedToStaffId,
      });
      if (result.ok) {
        setTasks((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(), venueId: "", leadId,
            title: titleInput.trim(), dueDate: dueDateInput || null,
            completed: false, completedAt: null, createdAt: new Date().toISOString(),
            assignedToStaffId, assigneeName,
          },
        ]);
        setTitleInput("");
        setDueDateInput("");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not add task.");
      }
    });
  }

  async function handleToggle(taskId: string, completed: boolean, title: string) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completed: !completed } : t));
    const result = await setTaskCompletedAction(taskId, !completed, leadId, title);
    if (!result.ok) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completed } : t));
      toast.error(result.message ?? "Could not update task.");
    } else {
      router.refresh();
    }
  }

  async function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const result = await deleteTaskAction(taskId);
    if (!result.ok) {
      toast.error(result.message ?? "Could not delete task.");
      router.refresh();
    }
  }

  async function handleUpdate(
    taskId: string,
    title: string,
    dueDate: string,
    assignedToStaffId: string | null,
  ) {
    const assigneeName = staffOptions.find((s) => s.id === assignedToStaffId)?.name ?? null;
    setTasks((prev) => prev.map((t) => t.id === taskId
      ? { ...t, title, dueDate: dueDate || null, assignedToStaffId, assigneeName }
      : t));
    const result = await updateTaskAction(taskId, { title, dueDate, assignedToStaffId });
    if (!result.ok) toast.error(result.message ?? "Could not update task.");
    else router.refresh();
  }

  const { open, completed: done } = partitionByCompletion(tasks, {
    isComplete: (t) => t.completed,
    getDueDate: (t) => t.dueDate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={`venue-task-title-${leadId}`} className="text-xs">Task title</Label>
          <Input
            id={`venue-task-title-${leadId}`}
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="New task…"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <div className="space-y-1.5 sm:w-40">
          <Label htmlFor={`venue-task-due-${leadId}`} className="text-xs">Due date</Label>
          <Input
            id={`venue-task-due-${leadId}`}
            type="date"
            value={dueDateInput}
            onChange={(e) => setDueDateInput(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:w-44">
          <Label className="text-xs">Assignee</Label>
          <Select
            value={assigneeInput || "__unassigned__"}
            onValueChange={(v) => setAssigneeInput(v === "__unassigned__" ? "" : v)}
            items={[
              { value: "__unassigned__", label: "Unassigned" },
              ...staffOptions.map((s) => ({ value: s.id, label: s.name })),
            ]}
          >
            <SelectTrigger className="w-full" aria-label="Assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="sm:mb-0.5"
          disabled={!titleInput.trim() || addPending}
          onClick={handleAdd}
        >
          <Plus className="mr-1 h-4 w-4" />Add
        </Button>
      </div>

      {tasks.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No venue tasks yet. Add a one-off action above — it also appears in Task Center.
        </p>
      )}

      {open.length > 0 && (
        <div className="space-y-1.5">
          {open.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              staffOptions={staffOptions}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed</p>
          {done.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              staffOptions={staffOptions}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
