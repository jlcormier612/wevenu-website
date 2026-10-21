"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addCustomClientEventTaskAction,
  removeClientEventTaskAction,
  replaceClientPlaybookAction,
  updateClientEventTaskFieldsAction,
} from "@/app/(app)/playbooks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import type { EventPlaybookApplication, EventTask, PlaybookTemplateWithStats } from "@/lib/playbooks/types";

type DraftRow = {
  id: string;
  title: string;
  daysOffset: number;
  description: string;
  dirty: boolean;
};

function toDraftRows(tasks: EventTask[]): DraftRow[] {
  return tasks
    .filter((t) => t.ownerType === "couple")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.daysOffset - b.daysOffset)
    .map((t) => ({
      id: t.id,
      title: t.title,
      daysOffset: t.daysOffset,
      description: t.description ?? "",
      dirty: false,
    }));
}

export function EventPlanningSetupEditor({
  open,
  onOpenChange,
  eventId,
  eventName,
  eventDate,
  clientName,
  profileName,
  applications,
  templates,
  tasks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  eventDate: string;
  clientName: string | null;
  profileName: string | null;
  applications: EventPlaybookApplication[];
  templates: PlaybookTemplateWithStats[];
  tasks: EventTask[];
}) {
  const router = useRouter();
  const clientApp = applications.find((a) => a.kind === "client");
  const clientTemplates = templates.filter((t) => t.kind === "client" && !t.isArchived);
  const [mode, setMode] = React.useState<"template" | "customize">("customize");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(
    clientApp?.templateId ?? clientTemplates[0]?.id ?? "",
  );
  const [rows, setRows] = React.useState<DraftRow[]>(() => toDraftRows(tasks));
  const [newTitle, setNewTitle] = React.useState("");
  const [newOffset, setNewOffset] = React.useState("-30");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setSelectedTemplateId(clientApp?.templateId ?? clientTemplates[0]?.id ?? "");
    setRows(toDraftRows(tasks));
    setMode("customize");
    setNewTitle("");
    setNewOffset("-30");
  }, [open, clientApp?.templateId, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirtyCustomize = rows.some((r) => r.dirty) || Boolean(newTitle.trim());
  const templateChanged = Boolean(
    selectedTemplateId && clientApp?.templateId && selectedTemplateId !== clientApp.templateId,
  );
  const released = Boolean(clientApp?.releasedAt);

  function requestClose() {
    if (pending) return;
    if ((mode === "customize" && dirtyCustomize) || (mode === "template" && templateChanged)) {
      if (!confirm("You have unsaved changes. Leave without saving?")) return;
    }
    onOpenChange(false);
  }

  function switchMode(next: "template" | "customize") {
    if (next === mode) return;
    if (mode === "customize" && dirtyCustomize) {
      if (!confirm("You have unsaved checklist edits. Switch anyway?")) return;
    }
    if (mode === "template" && templateChanged) {
      if (!confirm("You selected a different template but have not applied it. Switch anyway?")) return;
    }
    setMode(next);
  }

  function applyTemplate() {
    if (!selectedTemplateId) {
      toast.error("Choose a Client Planning template.");
      return;
    }
    if (released) {
      toast.error("Client Planning is already released. Setup edits are locked.");
      return;
    }
    if (
      !confirm(
        "Replace this event's client checklist with the selected template?\n\n"
        + "All current client checklist tasks on this event will be removed and replaced. "
        + "The reusable Library template will not change.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await replaceClientPlaybookAction(eventId, selectedTemplateId, eventDate);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message ?? "Template applied to this event.");
      router.refresh();
      onOpenChange(false);
    });
  }

  function saveRow(row: DraftRow) {
    if (released) {
      toast.error("Client Planning is already released. Setup edits are locked.");
      return;
    }
    startTransition(async () => {
      const result = await updateClientEventTaskFieldsAction(eventId, eventDate, row.id, {
        title: row.title,
        daysOffset: row.daysOffset,
        description: row.description,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, dirty: false } : r)));
      toast.success("Task saved for this event.");
      router.refresh();
    });
  }

  function removeRow(taskId: string) {
    if (released) {
      toast.error("Client Planning is already released. Setup edits are locked.");
      return;
    }
    if (!confirm("Remove this task from this event's checklist only?")) return;
    startTransition(async () => {
      const result = await removeClientEventTaskAction(eventId, taskId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== taskId));
      toast.success("Task removed from this event.");
      router.refresh();
    });
  }

  function addRow() {
    if (released) {
      toast.error("Client Planning is already released. Setup edits are locked.");
      return;
    }
    const title = newTitle.trim();
    if (!title) {
      toast.error("Enter a task title.");
      return;
    }
    const daysOffset = Number.parseInt(newOffset, 10);
    if (!Number.isFinite(daysOffset)) {
      toast.error("Days before/after event must be a number.");
      return;
    }
    startTransition(async () => {
      const result = await addCustomClientEventTaskAction(eventId, eventDate, {
        title,
        daysOffset,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setNewTitle("");
      toast.success("Task added to this event.");
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) requestClose(); else onOpenChange(true); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="event-planning-setup-editor"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Edit client checklist for this event</SheetTitle>
          <SheetDescription>
            {eventName}
            {clientName ? ` · ${clientName}` : ""}
            {profileName ? ` · from ${profileName}` : ""}
            . Changes apply only to this event and do not update the reusable Library template.
            Release still happens from Overview.
          </SheetDescription>
        </SheetHeader>

        {released ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Client Planning is already released. Use Open Planning for ongoing management.
          </p>
        ) : null}

        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "template" ? "default" : "outline"}
            data-testid="planning-setup-mode-template"
            onClick={() => switchMode("template")}
            disabled={pending || released}
          >
            Choose a different template
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "customize" ? "default" : "outline"}
            data-testid="planning-setup-mode-customize"
            onClick={() => switchMode("customize")}
            disabled={pending || released}
          >
            Customize this event&apos;s checklist
          </Button>
        </div>

        {mode === "template" ? (
          <div className="space-y-3" data-testid="planning-setup-template-path">
            <p className="text-sm text-muted-foreground">
              Current template:{" "}
              <span className="font-medium text-foreground">
                {clientApp?.templateName ?? "None applied yet"}
              </span>
            </p>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              items={clientTemplates.map((t) => ({ value: t.id, label: t.name }))}
            >
              <SelectTrigger data-testid="planning-setup-template-select">
                <SelectValue placeholder="Select a Client Planning template" />
              </SelectTrigger>
              <SelectContent>
                {clientTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    <span className="text-muted-foreground">
                      {" "}— {t.taskCount} task{t.taskCount === 1 ? "" : "s"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Applying a template replaces this event&apos;s current client checklist tasks.
              Customized tasks on this event will be removed. The Library copy stays unchanged.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={pending || released || !selectedTemplateId}
              data-testid="planning-setup-apply-template"
              onClick={applyTemplate}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply template to this event"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="planning-setup-customize-path">
            {!clientApp ? (
              <p className="text-sm text-muted-foreground">
                No client checklist is on this event yet. Choose a template first.
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {rows.map((row) => (
                    <li key={row.id} className="rounded-md border border-border p-3 space-y-2">
                      <Input
                        value={row.title}
                        aria-label="Task title"
                        disabled={pending || released}
                        onChange={(e) => {
                          const title = e.target.value;
                          setRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, title, dirty: true } : r)),
                          );
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-muted-foreground">
                          Days from event
                          <Input
                            type="number"
                            className="mt-1 w-24"
                            value={row.daysOffset}
                            disabled={pending || released}
                            onChange={(e) => {
                              const daysOffset = Number.parseInt(e.target.value, 10) || 0;
                              setRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, daysOffset, dirty: true } : r)),
                              );
                            }}
                          />
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || released || !row.dirty}
                          onClick={() => saveRow(row)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending || released}
                          onClick={() => removeRow(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                  <p className="text-sm font-medium text-heading">Add a task for this event</p>
                  <Input
                    placeholder="Task title"
                    value={newTitle}
                    disabled={pending || released}
                    data-testid="planning-setup-new-title"
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-muted-foreground">
                      Days from event
                      <Input
                        type="number"
                        className="mt-1 w-24"
                        value={newOffset}
                        disabled={pending || released}
                        onChange={(e) => setNewOffset(e.target.value)}
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || released}
                      data-testid="planning-setup-add-task"
                      onClick={addRow}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add task
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={pending}>
            Back to Overview
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
