"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import {
  replaceEventTimelineFromTemplateAction,
  saveEventTimelineDraftAction,
  updateEntryAction,
} from "@/app/(app)/events/[id]/timeline-actions";
import { TimeAmPmInput } from "@/components/ui/time-ampm-input";
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
import { cn } from "@/lib/utils";

type DraftRow = {
  id: string;
  title: string;
  entryTime: string;
  dayOffset: number;
  description: string;
  dirty: boolean;
  pendingRemove: boolean;
  isNew: boolean;
  owner: TimelineEntry["owner"];
};

let newRowSeq = 0;
function nextTempId() {
  newRowSeq += 1;
  return `new:${Date.now()}-${newRowSeq}`;
}

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
      pendingRemove: false,
      isNew: false,
      owner: e.owner,
    }));
}

function sortDraftRows(rows: DraftRow[]): DraftRow[] {
  return [...rows].sort((a, b) =>
    compareTimelineEntries(
      { dayOffset: a.dayOffset, entryTime: a.entryTime || null, sortOrder: 0 },
      { dayOffset: b.dayOffset, entryTime: b.entryTime || null, sortOrder: 0 },
    ),
  );
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
  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;
  const [newTitle, setNewTitle] = React.useState("");
  const [newTime, setNewTime] = React.useState("");
  const newTimeRef = React.useRef(newTime);
  newTimeRef.current = newTime;
  const [newDayOffset, setNewDayOffset] = React.useState("0");
  const [pending, startTransition] = React.useTransition();
  const [batchError, setBatchError] = React.useState<string | null>(null);
  const saveInFlight = React.useRef(false);

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
    setBatchError(null);
  }, [open, preferredTemplateId, entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirtyCustomize =
    rows.some((r) => r.dirty || r.pendingRemove || r.isNew)
    || Boolean(newTitle.trim());
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

  function patchRow(id: string, patch: Partial<DraftRow>) {
    setRows((prev) =>
      sortDraftRows(
        prev.map((r) => (r.id === id ? { ...r, ...patch, dirty: patch.dirty ?? true } : r)),
      ),
    );
  }

  /** Optional single-row save for an existing venue-owned item. */
  function saveRow(row: DraftRow) {
    if (row.owner !== "venue" || row.isNew || row.pendingRemove) {
      toast.error("Use Save all changes for new or pending-removal items.");
      return;
    }
    if (saveInFlight.current) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.tagName === "INPUT") {
      active.blur();
    }
    const latest = rowsRef.current.find((r) => r.id === row.id) ?? row;
    startTransition(async () => {
      saveInFlight.current = true;
      setBatchError(null);
      try {
        const result = await updateEntryAction(latest.id, eventId, {
          title: latest.title,
          description: latest.description,
          entryTime: latest.entryTime,
          dayOffset: latest.dayOffset,
        });
        if (!result.ok) {
          const msg = result.message ?? "Could not save timeline item.";
          setBatchError(msg);
          toast.error(msg);
          return;
        }
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, dirty: false } : r)));
        toast.success("Timeline item saved for this event.");
        router.refresh();
      } finally {
        saveInFlight.current = false;
      }
    });
  }

  function markRemove(row: DraftRow) {
    if (row.owner !== "venue") {
      toast.error("Client-owned timeline items are managed in the Timeline workspace.");
      return;
    }
    if (row.isNew) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    patchRow(row.id, { pendingRemove: true, dirty: true });
  }

  function undoRemove(row: DraftRow) {
    patchRow(row.id, { pendingRemove: false, dirty: true });
  }

  function addRowToDraft() {
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
    const row: DraftRow = {
      id: nextTempId(),
      title,
      entryTime: newTime,
      dayOffset,
      description: "",
      dirty: true,
      pendingRemove: false,
      isNew: true,
      owner: "venue",
    };
    setRows((prev) => sortDraftRows([...prev, row]));
    setNewTitle("");
    setNewTime("");
    setNewDayOffset("0");
  }

  function saveAllChanges() {
    if (saveInFlight.current || pending) return;

    // Ensure any focused TimeAmPmInput commits into draft state before we
    // read rows (blur → flushSync onChange re-renders; rowsRef picks it up).
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.tagName === "INPUT") {
      active.blur();
    }

    // Flush the add-row fields into the draft if the user typed a title
    // but did not click Add item yet.
    let working = rowsRef.current;
    const pendingTitle = newTitle.trim();
    if (pendingTitle) {
      const dayOffset = Number.parseInt(newDayOffset, 10);
      if (!Number.isFinite(dayOffset) || dayOffset < 0) {
        toast.error("Day offset must be zero or a positive number.");
        return;
      }
      const flushed: DraftRow = {
        id: nextTempId(),
        title: pendingTitle,
        entryTime: newTimeRef.current,
        dayOffset,
        description: "",
        dirty: true,
        pendingRemove: false,
        isNew: true,
        owner: "venue",
      };
      working = sortDraftRows([...working, flushed]);
      setRows(working);
      setNewTitle("");
      setNewTime("");
      setNewDayOffset("0");
    }

    const deleteIds = working.filter((r) => r.pendingRemove && !r.isNew).map((r) => r.id);
    const upserts = working
      .filter((r) => !r.pendingRemove && (r.isNew || r.dirty) && r.owner === "venue")
      .map((r) => ({
        id: r.isNew ? null : r.id,
        title: r.title,
        description: r.description,
        entryTime: r.entryTime,
        dayOffset: r.dayOffset,
      }));

    if (deleteIds.length === 0 && upserts.length === 0) {
      toast.message("No timeline changes to save.");
      return;
    }

    for (const u of upserts) {
      if (!u.title.trim()) {
        toast.error("Every timeline item needs a title.");
        return;
      }
    }

    startTransition(async () => {
      saveInFlight.current = true;
      setBatchError(null);
      try {
        const result = await saveEventTimelineDraftAction(eventId, { deleteIds, upserts });
        if (!result.ok) {
          const msg = result.message ?? "Could not save timeline changes.";
          setBatchError(msg);
          toast.error(msg);
          return;
        }
        // Keep editor open; map new temp ids → created server ids so a
        // second save before refresh cannot duplicate inserts.
        let createdIdx = 0;
        setRows((prev) =>
          sortDraftRows(
            prev
              .filter((r) => !r.pendingRemove)
              .map((r) => {
                if (r.isNew) {
                  const realId = result.createdIds[createdIdx++] ?? r.id;
                  return {
                    ...r,
                    id: realId,
                    isNew: false,
                    dirty: false,
                    pendingRemove: false,
                  };
                }
                return { ...r, dirty: false, pendingRemove: false };
              }),
          ),
        );
        const parts: string[] = [];
        if (result.created) parts.push(`${result.created} added`);
        if (result.updated) parts.push(`${result.updated} updated`);
        if (result.deleted) parts.push(`${result.deleted} removed`);
        toast.success(
          parts.length > 0
            ? `Timeline saved for this event (${parts.join(", ")}).`
            : "Timeline saved for this event.",
        );
        router.refresh();
      } finally {
        saveInFlight.current = false;
      }
    });
  }

  const visibleRows = rows;

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
            {visibleRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No timeline items on this event yet. Choose a template first, or add items below.
              </p>
            ) : (
              <ul className="space-y-3">
                {visibleRows.map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      "rounded-md border border-border p-3 space-y-2",
                      row.pendingRemove && "opacity-60 border-dashed",
                    )}
                    data-testid={row.pendingRemove ? "timeline-setup-row-pending-remove" : "timeline-setup-row"}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={row.title}
                        aria-label="Timeline item title"
                        disabled={pending || row.owner !== "venue" || row.pendingRemove}
                        onChange={(e) => {
                          const title = e.target.value;
                          setRows((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, title, dirty: true } : r)),
                          );
                        }}
                      />
                      {row.owner !== "venue" ? (
                        <span className="shrink-0 text-[11px] text-muted-foreground">Client-owned</span>
                      ) : row.pendingRemove ? (
                        <span className="shrink-0 text-[11px] text-destructive">Pending removal</span>
                      ) : row.isNew ? (
                        <span className="shrink-0 text-[11px] text-muted-foreground">New</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-xs text-muted-foreground">
                        Time
                        <TimeAmPmInput
                          className="mt-1 w-32"
                          value={row.entryTime}
                          disabled={pending || row.owner !== "venue" || row.pendingRemove}
                          data-testid="timeline-setup-row-time"
                          onChange={(entryTime) => {
                            setRows((prev) =>
                              sortDraftRows(
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, entryTime, dirty: true } : r,
                                ),
                              ),
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
                          disabled={pending || row.owner !== "venue" || row.pendingRemove}
                          onChange={(e) => {
                            const dayOffset = Number.parseInt(e.target.value, 10) || 0;
                            setRows((prev) =>
                              sortDraftRows(
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, dayOffset, dirty: true } : r,
                                ),
                              ),
                            );
                          }}
                        />
                      </label>
                      {row.owner === "venue" && !row.pendingRemove && !row.isNew ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || !row.dirty}
                          data-testid="timeline-setup-save-row"
                          onClick={() => saveRow(row)}
                        >
                          Save
                        </Button>
                      ) : null}
                      {row.owner === "venue" && row.pendingRemove ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          data-testid="timeline-setup-undo-remove"
                          onClick={() => undoRemove(row)}
                        >
                          <Undo2 className="mr-1 h-3.5 w-3.5" />
                          Undo
                        </Button>
                      ) : row.owner === "venue" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          data-testid="timeline-setup-mark-remove"
                          onClick={() => markRemove(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      ) : null}
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
                  <TimeAmPmInput
                    className="mt-1 w-32"
                    value={newTime}
                    disabled={pending}
                    data-testid="timeline-setup-new-time"
                    onChange={setNewTime}
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
                  onClick={addRowToDraft}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add item
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Added items stay in this draft until you save all changes.
              </p>
            </div>

            {batchError ? (
              <p className="text-sm text-destructive" data-testid="timeline-setup-batch-error" role="alert">
                {batchError}
              </p>
            ) : null}

            <div className="sticky bottom-0 -mx-1 border-t border-border bg-background pt-3 pb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {dirtyCustomize
                  ? "You have unsaved timeline edits for this event."
                  : "No unsaved timeline edits."}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={pending || !dirtyCustomize}
                data-testid="timeline-setup-save-all"
                onClick={saveAllChanges}
              >
                {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Save all changes
              </Button>
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
