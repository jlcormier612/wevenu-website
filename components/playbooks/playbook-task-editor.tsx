"use client";

/**
 * PlaybookTaskEditor — full CRUD for tasks within a playbook template.
 * Shows all task properties: offset, category, owner, visibility, dependencies, auto-complete.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addTemplateTaskAction,
  deleteTemplateTaskAction,
  updateTemplateTaskAction,
} from "@/app/(app)/playbooks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AUTO_COMPLETE_TRIGGERS, categoryColor, categoryLabel,
  formatDaysOffset, TASK_CATEGORIES, TASK_OWNERS, TASK_VISIBILITY,
} from "@/lib/playbooks/constants";
import type { PlaybookTask, TaskCategory, TaskOwner, TaskVisibility } from "@/lib/playbooks/types";

type TaskForm = {
  title: string;
  description: string;
  ownerType: TaskOwner;
  visibility: TaskVisibility;
  daysOffset: string;
  category: TaskCategory;
  autoCompleteTrigger: string;
  dependsOnTaskId: string;
  isRequired: boolean;
};

const EMPTY_FORM: TaskForm = {
  title: "", description: "", ownerType: "coordinator", visibility: "coordinator_only",
  daysOffset: "-30", category: "custom", autoCompleteTrigger: "", dependsOnTaskId: "", isRequired: true,
};

function TaskRow({
  task, allTasks, onEdit, onDelete,
}: { task: PlaybookTask; allTasks: PlaybookTask[]; onEdit: () => void; onDelete: () => void }) {
  const dep = allTasks.find((t) => t.id === task.dependsOnTaskId);
  return (
    <div className="group flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-heading">{task.title}</p>
          {!task.isRequired && <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">optional</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span style={{ color: categoryColor(task.category) }}>{categoryLabel(task.category)}</span>
          <span>·</span>
          <span>{formatDaysOffset(task.daysOffset)}</span>
          <span>·</span>
          <span>{task.ownerType}</span>
          {task.autoCompleteTrigger && <><span>·</span><span className="italic">auto-completes</span></>}
          {dep && <><span>·</span><span>depends on "{dep.title}"</span></>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button type="button" onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function TaskFormPanel({
  initial, allTasks, onSave, onCancel, pending, submitLabel,
}: { initial: TaskForm; allTasks: PlaybookTask[]; onSave: (f: TaskForm) => void; onCancel: () => void; pending: boolean; submitLabel: string }) {
  const [f, setF] = React.useState(initial);
  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="rounded-xl border border-ring bg-card p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs">Task title *</Label>
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Final payment due" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Days offset *</Label>
          <p className="text-[10px] text-muted-foreground">Negative = before event · Positive = after event</p>
          <Input type="number" value={f.daysOffset} onChange={(e) => set("daysOffset", e.target.value)} placeholder="-30" className="w-28" />
          {f.daysOffset && <p className="text-xs text-muted-foreground">{formatDaysOffset(parseInt(f.daysOffset) || 0)}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={f.category} onValueChange={(v) => set("category", v as TaskCategory)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Owner</Label>
          <Select value={f.ownerType} onValueChange={(v) => set("ownerType", v as TaskOwner)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_OWNERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Visibility</Label>
          <Select value={f.visibility} onValueChange={(v) => set("visibility", v as TaskVisibility)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_VISIBILITY.map((v) => <SelectItem key={v.value} value={v.value}><span>{v.label}</span></SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Auto-complete trigger</Label>
          <Select value={f.autoCompleteTrigger || "__none__"} onValueChange={(v) => set("autoCompleteTrigger", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{AUTO_COMPLETE_TRIGGERS.map((t) => <SelectItem key={t.value || "__none__"} value={t.value || "__none__"}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Depends on</Label>
          <Select value={f.dependsOnTaskId || "__none__"} onValueChange={(v) => set("dependsOnTaskId", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No dependency</SelectItem>
              {allTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Instructions for completing this task…" />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={f.isRequired} onCheckedChange={(v) => set("isRequired", v)} />
          <Label className="text-xs cursor-pointer">Required — affects Event Readiness score</Label>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!f.title.trim() || !f.daysOffset || pending} onClick={() => onSave(f)}>
          {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function PlaybookTaskEditor({
  templateId, initialTasks, allTemplateTasks,
}: { templateId: string; initialTasks: PlaybookTask[]; allTemplateTasks: PlaybookTask[] }) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState(initialTasks);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [addPending, startAdd] = React.useTransition();
  const [editPending, startEdit] = React.useTransition();

  function handleAdd(f: TaskForm) {
    startAdd(async () => {
      const result = await addTemplateTaskAction(templateId, {
        title: f.title.trim(), description: f.description.trim() || null,
        ownerType: f.ownerType, visibility: f.visibility,
        daysOffset: parseInt(f.daysOffset, 10) || 0,
        category: f.category, autoCompleteTrigger: f.autoCompleteTrigger || null,
        dependsOnTaskId: f.dependsOnTaskId || null, isRequired: f.isRequired, sortOrder: tasks.length,
      });
      if (result.ok) { toast.success("Task added."); setShowAdd(false); router.refresh(); }
      else toast.error(result.message ?? "Could not add task.");
    });
  }

  function handleEdit(taskId: string, f: TaskForm) {
    startEdit(async () => {
      const result = await updateTemplateTaskAction(taskId, {
        title: f.title.trim(), description: f.description.trim() || null,
        ownerType: f.ownerType, visibility: f.visibility,
        daysOffset: parseInt(f.daysOffset, 10) || 0,
        category: f.category, autoCompleteTrigger: f.autoCompleteTrigger || null,
        dependsOnTaskId: f.dependsOnTaskId || null, isRequired: f.isRequired,
      });
      if (result.ok) { toast.success("Task updated."); setEditingId(null); router.refresh(); }
      else toast.error(result.message ?? "Could not update task.");
    });
  }

  async function handleDelete(taskId: string, title: string) {
    if (!confirm(`Remove "${title}" from this template?`)) return;
    setTasks((p) => p.filter((t) => t.id !== taskId));
    const result = await deleteTemplateTaskAction(taskId);
    if (!result.ok) { toast.error(result.message ?? "Could not delete."); router.refresh(); }
  }

  const editingTask = tasks.find((t) => t.id === editingId);
  const sortedTasks = [...tasks].sort((a, b) => a.daysOffset - b.daysOffset);

  return (
    <div className="space-y-3">
      {sortedTasks.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground py-4 text-center">No tasks defined. Add the first task below.</p>
      )}
      <div className="space-y-0">
        {sortedTasks.map((task) =>
          editingId === task.id && editingTask ? (
            <TaskFormPanel key={task.id}
              initial={{ title: task.title, description: task.description ?? "", ownerType: task.ownerType, visibility: task.visibility, daysOffset: String(task.daysOffset), category: task.category, autoCompleteTrigger: task.autoCompleteTrigger ?? "", dependsOnTaskId: task.dependsOnTaskId ?? "", isRequired: task.isRequired }}
              allTasks={sortedTasks.filter((t) => t.id !== task.id)}
              onSave={(f) => handleEdit(task.id, f)} onCancel={() => setEditingId(null)}
              pending={editPending} submitLabel="Save task" />
          ) : (
            <TaskRow key={task.id} task={task} allTasks={sortedTasks}
              onEdit={() => setEditingId(task.id)} onDelete={() => handleDelete(task.id, task.title)} />
          )
        )}
      </div>
      {showAdd ? (
        <TaskFormPanel initial={EMPTY_FORM} allTasks={sortedTasks}
          onSave={handleAdd} onCancel={() => setShowAdd(false)}
          pending={addPending} submitLabel="Add task" />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Task
        </Button>
      )}
    </div>
  );
}
