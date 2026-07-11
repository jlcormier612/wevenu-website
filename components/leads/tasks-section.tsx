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
import { formatDate, isOverdue, isDueToday } from "@/lib/leads/constants";
import type { LeadTask } from "@/lib/leads/types";
import { cn } from "@/lib/utils";

function TaskRow({
  task,
  leadId,
  onToggle,
  onDelete,
  onUpdate,
}: {
  task: LeadTask;
  leadId: string;
  onToggle: (id: string, completed: boolean, title: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, title: string, dueDate: string) => void;
}) {
  const [editMode, setEditMode] = React.useState(false);
  const [title, setTitle] = React.useState(task.title);
  const [dueDate, setDueDate] = React.useState(task.dueDate ?? "");

  function saveEdit() {
    if (!title.trim()) return;
    onUpdate(task.id, title, dueDate);
    setEditMode(false);
  }

  const overdue = !task.completed && isOverdue(task.dueDate);
  const dueToday = !task.completed && !overdue && isDueToday(task.dueDate);

  if (editMode) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-ring bg-card p-2.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 h-7 text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") { setTitle(task.title); setDueDate(task.dueDate ?? ""); setEditMode(false); }
          }}
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-32 h-7 shrink-0 text-sm"
        />
        <Button type="button" size="sm" disabled={!title.trim()} onClick={saveEdit}>
          <Check className="mr-1 h-3.5 w-3.5" />Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setTitle(task.title); setDueDate(task.dueDate ?? ""); setEditMode(false); }}>
          Cancel
        </Button>
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
      <span
        className={cn(
          "flex-1 text-sm cursor-pointer",
          task.completed ? "text-muted-foreground line-through" : "text-foreground",
        )}
        onClick={() => !task.completed && setEditMode(true)}
      >
        {task.title}
      </span>
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
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
}: {
  leadId: string;
  initialTasks: LeadTask[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState(initialTasks);
  const [titleInput, setTitleInput] = React.useState("");
  const [dueDateInput, setDueDateInput] = React.useState("");
  const [addPending, startAdd] = React.useTransition();

  function handleAdd() {
    if (!titleInput.trim()) return;
    startAdd(async () => {
      const result = await addTaskAction(leadId, { title: titleInput, dueDate: dueDateInput });
      if (result.ok) {
        setTasks((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(), venueId: "", leadId,
            title: titleInput.trim(), dueDate: dueDateInput || null,
            completed: false, completedAt: null, createdAt: new Date().toISOString(),
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

  async function handleUpdate(taskId: string, title: string, dueDate: string) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, title, dueDate: dueDate || null } : t));
    const result = await updateTaskAction(taskId, { title, dueDate });
    if (!result.ok) toast.error(result.message ?? "Could not update task.");
  }

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <div className="space-y-4">
      {/* Add task */}
      <div className="flex items-center gap-2">
        <Input
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          placeholder="New task…"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1"
        />
        <Input
          type="date"
          value={dueDateInput}
          onChange={(e) => setDueDateInput(e.target.value)}
          className="w-36 shrink-0"
        />
        <Button type="button" disabled={!titleInput.trim() || addPending} onClick={handleAdd}>
          <Plus className="mr-1 h-4 w-4" />Add
        </Button>
      </div>

      {tasks.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">No tasks yet. Add one above.</p>
      )}

      {open.length > 0 && (
        <div className="space-y-1.5">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} leadId={leadId} onToggle={handleToggle} onDelete={handleDelete} onUpdate={handleUpdate} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed</p>
          {done.map((t) => (
            <TaskRow key={t.id} task={t} leadId={leadId} onToggle={handleToggle} onDelete={handleDelete} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
