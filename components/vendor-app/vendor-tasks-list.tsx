"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { CheckSquare, Circle, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeVendorTaskAction, uncompleteVendorTaskAction, deleteVendorTaskAction, createVendorTaskAction } from "@/app/vendor/tasks/actions";
import type { VendorPersonalTask } from "@/lib/vendors/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekFromNowIso(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const SOURCE_LABELS: Record<VendorPersonalTask["source"], string> = {
  manual:     "Personal",
  venue:      "Venue",
  luv:        "✦ Luv",
  automation: "Auto",
};

type Group = "overdue" | "today" | "this_week" | "later" | "no_date" | "complete";

function groupTask(t: VendorPersonalTask): Group {
  if (t.status === "complete") return "complete";
  if (!t.dueDate) return "no_date";
  const today = todayIso();
  const week  = weekFromNowIso();
  if (t.dueDate < today)  return "overdue";
  if (t.dueDate === today) return "today";
  if (t.dueDate <= week)  return "this_week";
  return "later";
}

const GROUP_ORDER: Group[] = ["overdue", "today", "this_week", "later", "no_date", "complete"];
const GROUP_LABELS: Record<Group, string> = {
  overdue:   "Overdue",
  today:     "Due Today",
  this_week: "Due This Week",
  later:     "Later",
  no_date:   "No Due Date",
  complete:  "Completed",
};

export function VendorTasksList({ tasks }: { tasks: VendorPersonalTask[] }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm]    = React.useState(false);
  const [newTitle, setNewTitle]    = React.useState("");
  const [newDue, setNewDue]        = React.useState("");
  const [formError, setFormError]  = React.useState<string | null>(null);

  function handleToggle(t: VendorPersonalTask) {
    startTransition(async () => {
      if (t.status === "pending") {
        await completeVendorTaskAction(t.id);
      } else {
        await uncompleteVendorTaskAction(t.id);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteVendorTaskAction(id); });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setFormError(null);
    startTransition(async () => {
      const result = await createVendorTaskAction({
        title:           newTitle.trim(),
        dueDate:         newDue,
        vendorInquiryId: "",
        eventId:         "",
        notes:           "",
      });
      if (result.ok) {
        setNewTitle("");
        setNewDue("");
        setShowForm(false);
      } else {
        setFormError("message" in result ? (result.message ?? "Error") : "Error");
      }
    });
  }

  // Group tasks
  const groups = new Map<Group, VendorPersonalTask[]>();
  for (const g of GROUP_ORDER) groups.set(g, []);
  for (const t of tasks) {
    const g = groupTask(t);
    groups.get(g)!.push(t);
  }

  const pendingCount = tasks.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">{pendingCount} pending</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Task
        </Button>
      </div>

      {/* New task form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">New Task</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Task title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="date"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={pending || !newTitle.trim()}>
                {pending ? "…" : "Add"}
              </Button>
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </form>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <CheckSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No tasks yet</p>
          <p className="text-xs mt-1 text-muted-foreground">
            Add personal tasks or they&apos;ll appear when venues assign you work.
          </p>
        </div>
      )}

      {/* Groups */}
      {GROUP_ORDER.map((group) => {
        const items = groups.get(group) ?? [];
        if (items.length === 0) return null;
        return (
          <div key={group} className="space-y-2">
            <h2 className={`text-xs font-semibold uppercase tracking-wide ${
              group === "overdue" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {GROUP_LABELS[group]} <span className="font-normal">({items.length})</span>
            </h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {items.map((t) => (
                <div key={t.id} className="flex items-start gap-3 px-4 py-3 group">
                  <button
                    type="button"
                    onClick={() => handleToggle(t)}
                    disabled={pending}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t.status === "complete"
                      ? <CheckSquare className="h-4 w-4 text-success" />
                      : <Circle className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className={`text-sm ${t.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {t.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {t.dueDate && (
                        <span className={`text-xs ${t.dueDate < todayIso() && t.status !== "complete" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {formatDate(t.dueDate)}
                        </span>
                      )}
                      {t.eventId && (
                        <Link href={`/vendor/events`} className="text-xs text-primary hover:underline">
                          Event →
                        </Link>
                      )}
                      {t.source !== "manual" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {SOURCE_LABELS[t.source]}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    disabled={pending}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
