"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEntryAction,
  deleteEntryAction,
  replaceEventTimelineFromTemplateAction,
  updateEntryAction,
} from "@/app/(app)/events/[id]/timeline-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { compareTimelineEntries } from "@/lib/timeline/constants";
import type { TimelineEntry } from "@/lib/timeline/types";
import type { TimelineTemplateWithStats } from "@/lib/timeline-templates/types";

type DraftRow = {
  id: string;
  title: string;
  entryTime: string;
  dayOffset: number;
  description: string;
  dirty: boolean;
  owner: TimelineEntry["owner"];
};

function toDraftRows(entries: TimelineEntry[]): DraftRow[] {
  return [...entries]
    .sort(compareTimelineEntries)
    .map((e) => ({
      id: e.id,
      title: e.title,
      entryTime: e.entryTime ?? "",
      dayOffset: e.dayOffset,
      description: e.description ?? "",
      dirty: false,
      owner: e.owner,
    }));
}

export function EventTimelineSetupEditor({
  open,
  onOpenChange,
  eventId,
  eventName,
  eventStartTime,
  profileName,
  preferredTemplateId,
  templates,
  entries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  eventStartTime: string | null;
  profileName: string | null;
  preferredTemplateId: string | null;
  templates: TimelineTemplateWithStats[];
  entries: TimelineEntry[];
}) {
  const router = useRouter();
  const activeTemplates = templates.filter((t) => !t.isArchived);
  const [mode, setMode] = React.useState<"template" | "customize">("customize");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(
    preferredTemplateId && activeTemplates.some((t) => t.id === preferredTemplateId)
      ? preferredTemplateId
      : activeTemplates[0]?.id ?? "",
  );
  const [rows, setRows] = React.useState<DraftRow[]>(() => toDraftRows(entries));
  const [newTitle, setNewTitle] = React.useState("");
  const [newTime, setNewTime] = React.useState("");
  const [newDayOffset, setNewDayOffset] = React.useState("0");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setSelectedTemplateId(
      preferredTemplateId && activeTemplates.some((t) => t.id === preferredTemplateId)
        ? preferredTemplateId
        : activeTemplates[0]?.id ?? "",
    );
    setRows(toDraftRows(entries));
    setMode("customize");
    setNewTitle("");
    setNewTime("");
    setNewDayOffset("0");
  }, [open, preferredTemplateId, entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirtyCustomize = rows.some((r) => r.dirty) || Boolean(newTitle.trim());
  const currentTemplateName = preferredTemplateId
    ? activeTemplates.find((t) => t.id === preferredTemplateId)?.name ?? null
    : null;
  const templateChanged = Boolean(
    selectedTemplateId
    && preferredTemplateId
    && selectedTemplateId !== preferredTemplateId,
  );

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
      if (!confirm("You have unsaved timeline edits. Switch anyway?")) return;
    }
    if (mode === "template" && templateChanged) {
      if (!confirm("You selected a different template but have not applied it. Switch anyway?")) return;
    }
    setMode(next);
  }

  /** Leave template selection without applying — restores prior selection, no save. */
  function cancelTemplateSelection() {
    setSelectedTemplateId(
      preferredTemplateId && activeTemplates.some((t) => t.id === preferredTemplateId)
        ? preferredTemplateId
        : activeTemplates[0]?.id ?? "",
    );
    setMode("customize");
  }

  function applyTemplate() {
    if (!selectedTemplateId) {
      toast.error("Choose a timeline template.");
      return;
    }
    if (
      !confirm(
        "Replace this event's venue-owned timeline items with the selected template?\n\n"
        + "Venue-owned items on this event will be removed and replaced. "
        + "Client-owned items are kept. The Library template is not changed. "
        + "This does not share the timeline with the client — Release from Overview still controls sharing.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await replaceEventTimelineFromTemplateAction(
        eventId,
        selectedTemplateId,
        eventStartTime,
      );
      if (!result.ok) {
        toast.error(result.message ?? "Could not switch the timeline template.");
        return;
      }
      toast.success("This event's timeline now uses the selected template. The Library was not changed.");
      setMode("customize");
      router.refresh();
    });
  }

  function saveRow(row: DraftRow) {
    if (row.owner !== "venue") {
      toast.error("Client-owned timeline items are edited in the Timeline workspace.");
      return;
    }
    startTransition(async () => {
      const result = await updateEntryAction(row.id, eventId, {
        title: row.title,
        description: row.description,
        entryTime: row.entryTime,
        dayOffset: row.dayOffset,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not save timeline item.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, dirty: false } : r)));
      toast.success("Timeline item saved for this event.");
      router.refresh();
    });
  }

  function removeRow(row: DraftRow) {
    if (row.owner !== "venue") {
      toast.error("Client-owned timeline items are managed in the Timeline workspace.");
      return;
    }
    if (!confirm("Remove this item from this event's timeline only?")) return;
    startTransition(async () => {
      const result = await deleteEntryAction(row.id, eventId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not remove timeline item.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("Item removed from this event.");
      router.refresh();
    });
  }

  function addRow() {
    const title = newTitle.trim();
    if (!title) {
      toast.error("Enter an item title.");
      return;
    }
    const dayOffset = Number.parseInt(newDayOffset, 10);
    if (!Number.isFinite(dayOffset) || dayOffset < 0) {
      toast.error("Day offset must be zero or a positive number.");
      return;
    }
    startTransition(async () => {
      const result = await addEntryAction(eventId, {
        title,
        description: "",
        entryTime: newTime.trim(),
        dayOffset,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not add timeline item.");
        return;
      }
      setNewTitle("");
      setNewTime("");
      toast.success("Item added to this event's timeline.");
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) requestClose(); else onOpenChange(true); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="event-timeline-setup-editor"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Edit timeline for this event</SheetTitle>
          <SheetDescription>
            {eventName}
            {profileName ? ` · from ${profileName}` : ""}
            . Changes apply only to this event and do not update the reusable Library template.
            Sharing with the client still happens from Overview Release (or Timeline management).
          </SheetDescription>
        </SheetHeader>

        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "template" ? "default" : "outline"}
            data-testid="timeline-setup-mode-template"
            onClick={() => switchMode("template")}
            disabled={pending}
          >
            Choose a different template
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "customize" ? "default" : "outline"}
            data-testid="timeline-setup-mode-customize"
            onClick={() => switchMode("customize")}
            disabled={pending}
          >
            Customize this event&apos;s timeline
          </Button>
        </div>

        {mode === "template" ? (
          <div className="space-y-3" data-testid="timeline-setup-template-path">
            <p className="text-sm text-muted-foreground">
              Profile starting template:{" "}
              <span className="font-medium text-foreground">
                {currentTemplateName ?? "None recorded"}
              </span>
            </p>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              items={activeTemplates.map((t) => ({ value: t.id, label: t.name }))}
            >
              <SelectTrigger data-testid="timeline-setup-template-select">
                <SelectValue placeholder="Select a timeline template" />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    <span className="text-muted-foreground">
                      {" "}— {t.itemCount} item{t.itemCount === 1 ? "" : "s"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Applying replaces venue-owned items on this event only. Client-owned items stay.
              This does not share the timeline or change the Library template.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending || !selectedTemplateId}
                data-testid="timeline-setup-apply-template"
                onClick={applyTemplate}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply template to this event"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                data-testid="timeline-setup-cancel-template"
                onClick={cancelTemplateSelection}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4" data-testid="timeline-setup-customize-path">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No timeline items on this event yet. Choose a template first, or add items below.
              </p>
            ) : (
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li key={row.id} className="rounded-md border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={row.title}
                        aria-label="Timeline item title"
                        disabled={pending || row.owner !== "venue"}
                        onChange={(e) => {
                          const title = e.target.value;
                          setRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, title, dirty: true } : r)),
                          );
                        }}
                      />
                      {row.owner !== "venue" ? (
                        <span className="shrink-0 text-[11px] text-muted-foreground">Client-owned</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Time
                        <Input
                          className="mt-1 w-28"
                          placeholder="HH:MM"
                          value={row.entryTime}
                          disabled={pending || row.owner !== "venue"}
                          onChange={(e) => {
                            const entryTime = e.target.value;
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, entryTime, dirty: true } : r)),
                            );
                          }}
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Day offset
                        <Input
                          type="number"
                          className="mt-1 w-24"
                          value={row.dayOffset}
                          disabled={pending || row.owner !== "venue"}
                          onChange={(e) => {
                            const dayOffset = Number.parseInt(e.target.value, 10) || 0;
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, dayOffset, dirty: true } : r)),
                            );
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending || row.owner !== "venue" || !row.dirty}
                        onClick={() => saveRow(row)}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending || row.owner !== "venue"}
                        onClick={() => removeRow(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-md border border-dashed border-border p-3 space-y-2">
              <p className="text-sm font-medium text-heading">Add a venue-owned item for this event</p>
              <Input
                placeholder="Item title"
                value={newTitle}
                disabled={pending}
                data-testid="timeline-setup-new-title"
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-muted-foreground">
                  Time
                  <Input
                    className="mt-1 w-28"
                    placeholder="HH:MM"
                    value={newTime}
                    disabled={pending}
                    onChange={(e) => setNewTime(e.target.value)}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Day offset
                  <Input
                    type="number"
                    className="mt-1 w-24"
                    value={newDayOffset}
                    disabled={pending}
                    onChange={(e) => setNewDayOffset(e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  data-testid="timeline-setup-add-item"
                  onClick={addRow}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add item
                </Button>
              </div>
            </div>
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
