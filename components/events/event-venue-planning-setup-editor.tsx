"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addCustomVenueEventTaskAction,
  removeVenueEventTaskAction,
  replaceVenuePlaybookAction,
  updateVenueEventTaskFieldsAction,
} from "@/app/(app)/playbooks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
    .filter((t) => t.ownerType !== "couple")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.daysOffset - b.daysOffset)
    .map((t) => ({
      id: t.id,
      title: t.title,
      daysOffset: t.daysOffset,
      description: t.description ?? "",
      dirty: false,
    }));
}

/** Event-specific Venue Planning setup — sibling to the accepted client editor. */
export function EventVenuePlanningSetupEditor({
  eventId,
  eventDate,
  profileName,
  applications,
  templates,
  tasks,
  active,
}: {
  eventId: string;
  eventDate: string;
  profileName: string | null;
  applications: EventPlaybookApplication[];
  templates: PlaybookTemplateWithStats[];
  tasks: EventTask[];
  /** When false, skip syncing local draft state (parent tab inactive). */
  active: boolean;
}) {
  const router = useRouter();
  const venueApp = applications.find((a) => a.kind === "venue");
  const venueTemplates = templates.filter((t) => t.kind === "venue" && !t.isArchived);
  const preferredId =
    venueApp?.templateId
    ?? venueTemplates[0]?.id
    ?? "";
  const [mode, setMode] = React.useState<"template" | "customize">("customize");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(preferredId);
  const [rows, setRows] = React.useState<DraftRow[]>(() => toDraftRows(tasks));
  const [newTitle, setNewTitle] = React.useState("");
  const [newOffset, setNewOffset] = React.useState("-14");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!active) return;
    setSelectedTemplateId(venueApp?.templateId ?? venueTemplates[0]?.id ?? "");
    setRows(toDraftRows(tasks));
    setMode("customize");
    setNewTitle("");
    setNewOffset("-14");
  }, [active, venueApp?.templateId, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirtyCustomize = rows.some((r) => r.dirty) || Boolean(newTitle.trim());
  const templateChanged = Boolean(
    selectedTemplateId && venueApp?.templateId && selectedTemplateId !== venueApp.templateId,
  );

  function switchMode(next: "template" | "customize") {
    if (next === mode) return;
    if (mode === "customize" && dirtyCustomize) {
      if (!confirm("You have unsaved venue checklist edits. Switch anyway?")) return;
    }
    if (mode === "template" && templateChanged) {
      if (!confirm("You selected a different template but have not applied it. Switch anyway?")) return;
    }
    setMode(next);
  }

  function applyTemplate() {
    if (!selectedTemplateId) {
      toast.error("Choose a Venue Planning template.");
      return;
    }
    if (
      !confirm(
        "Replace this event's venue checklist with the selected template?\n\n"
        + "All current venue checklist tasks on this event will be removed and replaced, "
        + "including any completed work on those tasks. "
        + "The reusable Library template will not change. "
        + "Venue tasks stay internal and are never released to the client portal.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await replaceVenuePlaybookAction(eventId, selectedTemplateId, eventDate);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message ?? "Venue template applied to this event.");
      router.refresh();
    });
  }

  function saveRow(row: DraftRow) {
    startTransition(async () => {
      const result = await updateVenueEventTaskFieldsAction(eventId, eventDate, row.id, {
        title: row.title,
        daysOffset: row.daysOffset,
        description: row.description,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, dirty: false } : r)));
      toast.success("Venue task saved for this event.");
      router.refresh();
    });
  }

  function removeRow(taskId: string) {
    if (!confirm("Remove this task from this event's venue checklist only?")) return;
    startTransition(async () => {
      const result = await removeVenueEventTaskAction(eventId, taskId);
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
      const result = await addCustomVenueEventTaskAction(eventId, eventDate, {
        title,
        daysOffset,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setNewTitle("");
      toast.success("Task added to this event's venue checklist.");
      router.refresh();
    });
  }

  return (
    <div data-testid="event-venue-planning-setup-editor">
      <p className="mb-4 text-sm text-muted-foreground">
        Venue / internal checklist
        {profileName ? ` · from ${profileName}` : ""}
        . Edits apply only to this event. These tasks stay internal and are never released to the client portal.
        The Library template is not changed. Ongoing fulfillment stays on Open Planning.
      </p>

      <div className="mb-4 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "template" ? "default" : "outline"}
          data-testid="venue-planning-setup-mode-template"
          onClick={() => switchMode("template")}
          disabled={pending}
        >
          Choose a different template
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "customize" ? "default" : "outline"}
          data-testid="venue-planning-setup-mode-customize"
          onClick={() => switchMode("customize")}
          disabled={pending}
        >
          Customize this event&apos;s checklist
        </Button>
      </div>

      {mode === "template" ? (
        <div className="space-y-3" data-testid="venue-planning-setup-template-path">
          <p className="text-sm text-muted-foreground">
            Current template:{" "}
            <span className="font-medium text-foreground">
              {venueApp?.templateName ?? "None applied yet"}
            </span>
          </p>
          <Select
            value={selectedTemplateId}
            onValueChange={setSelectedTemplateId}
            items={venueTemplates.map((t) => ({ value: t.id, label: t.name }))}
          >
            <SelectTrigger data-testid="venue-planning-setup-template-select">
              <SelectValue placeholder="Select a Venue Planning template" />
            </SelectTrigger>
            <SelectContent>
              {venueTemplates.map((t) => (
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
            Applying a template replaces this event&apos;s current venue checklist tasks.
            Completion history on those tasks will be removed. The Library copy stays unchanged.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={pending || !selectedTemplateId}
            data-testid="venue-planning-setup-apply-template"
            onClick={applyTemplate}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply template to this event"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4" data-testid="venue-planning-setup-customize-path">
          {!venueApp ? (
            <p className="text-sm text-muted-foreground">
              No venue checklist is on this event yet. Choose a template first.
            </p>
          ) : (
            <>
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li key={row.id} className="rounded-md border border-border p-3 space-y-2">
                    <Input
                      value={row.title}
                      aria-label="Venue task title"
                      disabled={pending}
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
                          disabled={pending}
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
                        disabled={pending || !row.dirty}
                        onClick={() => saveRow(row)}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
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
                <p className="text-sm font-medium text-heading">Add a venue task for this event</p>
                <Input
                  placeholder="Task title"
                  value={newTitle}
                  disabled={pending}
                  data-testid="venue-planning-setup-new-title"
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-muted-foreground">
                    Days from event
                    <Input
                      type="number"
                      className="mt-1 w-24"
                      value={newOffset}
                      disabled={pending}
                      onChange={(e) => setNewOffset(e.target.value)}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    data-testid="venue-planning-setup-add-task"
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
    </div>
  );
}
