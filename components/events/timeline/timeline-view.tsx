"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Pencil,
  Plus,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import {
  addEntryAction,
  deleteEntryAction,
  reorderEntryAction,
  updateEntryAction,
} from "@/app/(app)/events/[id]/timeline-actions";
import { TemplatePicker } from "@/components/events/timeline/template-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/timeline/constants";
import type { TimelineAudience, TimelineEntry, TimelineEntryInput } from "@/lib/timeline/types";
import { TIMELINE_AUDIENCES } from "@/lib/timeline/types";
import { cn } from "@/lib/utils";

// ---- Entry form (shared for add and edit) -----------------------------------

function EntryForm({
  initial,
  onSave,
  onCancel,
  pending,
  submitLabel,
}: {
  initial: TimelineEntryInput;
  onSave: (input: TimelineEntryInput) => void;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
}) {
  const [title, setTitle] = React.useState(initial.title);
  const [description, setDescription] = React.useState(initial.description);
  const [entryTime, setEntryTime] = React.useState(initial.entryTime);
  const [audiences, setAudiences] = React.useState<TimelineAudience[]>(
    initial.audiences ?? ["internal"]
  );

  function toggleAudience(a: TimelineAudience) {
    setAudiences(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-ring bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="et-title" className="text-xs">Title *</Label>
          <Input
            id="et-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ceremony begins"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                onSave({ title, description, entryTime, audiences });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-time" className="text-xs">Time</Label>
          <Input
            id="et-time"
            type="time"
            value={entryTime}
            onChange={(e) => setEntryTime(e.target.value)}
            className="w-32"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="et-desc" className="text-xs">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="et-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any notes for the team…"
          rows={2}
        />
      </div>
      {/* Audience visibility */}
      <div className="space-y-1.5">
        <Label className="text-xs">Visible to</Label>
        <div className="flex gap-1.5 flex-wrap">
          {TIMELINE_AUDIENCES.map(a => (
            <button
              key={a.value}
              type="button"
              onClick={() => toggleAudience(a.value)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                audiences.includes(a.value)
                  ? "text-white border-transparent"
                  : "border-border text-muted-foreground hover:border-ring"
              }`}
              style={audiences.includes(a.value) ? { background: a.color } : {}}
            >
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
        {audiences.includes("guest") && (
          <p className="text-[10px] text-muted-foreground">
            🌿 This entry will appear on the wedding website's Day-of Schedule.
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          <X className="mr-1 h-3.5 w-3.5" />Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!title.trim() || pending}
          onClick={() => onSave({ title, description, entryTime, audiences })}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}

// ---- Single timeline entry row ----------------------------------------------

function TimelineEntryRow({
  entry,
  isFirst,
  isLast,
  sameTimeAsNext,
  sameTimeAsPrev,
  eventStartTime,
  onDelete,
  onUpdate,
  onReorder,
}: {
  entry: TimelineEntry;
  isFirst: boolean;
  isLast: boolean;
  sameTimeAsNext: boolean;
  sameTimeAsPrev: boolean;
  eventStartTime: string | null;
  onDelete: (id: string) => void;
  onUpdate: (id: string, input: TimelineEntryInput) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [updatePending, startUpdate] = React.useTransition();

  const isEventStart =
    eventStartTime && entry.entryTime === eventStartTime.slice(0, 5);
  const canMoveUp = sameTimeAsPrev;
  const canMoveDown = sameTimeAsNext;

  function handleUpdate(input: TimelineEntryInput) {
    startUpdate(async () => {
      const result = await updateEntryAction(entry.id, entry.eventId, input);
      if (result.ok) {
        onUpdate(entry.id, input);
        setEditing(false);
      } else {
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  return (
    <div className="group relative flex gap-4">
      {/* Timeline line + circle */}
      <div className="flex shrink-0 flex-col items-center">
        <div
          className={cn(
            "mt-1 flex h-8 w-8 items-center justify-center rounded-full border-2 z-10 text-xs font-semibold transition-colors",
            isEventStart
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground",
          )}
        >
          {isEventStart ? "★" : <Clock className="h-3.5 w-3.5" />}
        </div>
        {/* Vertical connector (not on last) */}
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>

      {/* Content */}
      <div className={cn("min-w-0 flex-1 pb-6", isLast && "pb-0")}>
        {editing ? (
          <EntryForm
            initial={{
              title: entry.title,
              description: entry.description ?? "",
              entryTime: entry.entryTime ?? "",
              audiences: entry.audiences,
            }}
            onSave={handleUpdate}
            onCancel={() => setEditing(false)}
            pending={updatePending}
            submitLabel="Save"
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-3 hover:border-border/80 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.entryTime && (
                    <span className="shrink-0 text-xs font-semibold text-heading">
                      {formatTime(entry.entryTime)}
                    </span>
                  )}
                  {isEventStart && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Event start
                    </span>
                  )}
                  {!entry.entryTime && (
                    <span className="text-[10px] text-muted-foreground italic">No time set</span>
                  )}
                </div>
                <p className="mt-0.5 text-sm font-medium text-foreground">{entry.title}</p>
                {entry.description && (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                    {entry.description}
                  </p>
                )}
                {/* Audience badges — only show non-internal audiences */}
                {entry.audiences && entry.audiences.some(a => a !== "internal") && (
                  <div className="mt-1.5 flex gap-1 flex-wrap">
                    {TIMELINE_AUDIENCES.filter(a => a.value !== "internal" && entry.audiences.includes(a.value)).map(a => (
                      <span key={a.value} className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
                        style={{ background: a.color }}>
                        {a.emoji} {a.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {canMoveUp && (
                  <button
                    type="button"
                    onClick={() => onReorder(entry.id, "up")}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                )}
                {canMoveDown && (
                  <button
                    type="button"
                    onClick={() => onReorder(entry.id, "down")}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main timeline view ----------------------------------------------------

export function TimelineView({
  eventId,
  eventStartTime,
  initialEntries,
}: {
  eventId: string;
  eventStartTime: string | null;
  initialEntries: TimelineEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = React.useState(initialEntries);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [addPending, startAdd] = React.useTransition();

  // Sorted by time, then sort_order, then created_at — mirrors DB sort
  const sorted = React.useMemo(
    () =>
      [...entries].sort((a, b) => {
        const ta = a.entryTime ?? "99:99";
        const tb = b.entryTime ?? "99:99";
        if (ta !== tb) return ta < tb ? -1 : 1;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [entries],
  );

  function handleAdd(input: TimelineEntryInput) {
    startAdd(async () => {
      const result = await addEntryAction(eventId, input);
      if (result.ok) {
        setEntries((prev) => [...prev, result.entry]);
        setShowAddForm(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not add entry.");
      }
    });
  }

  async function handleDelete(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    const result = await deleteEntryAction(entryId, eventId);
    if (!result.ok) {
      toast.error("Could not delete entry.");
      router.refresh();
    }
  }

  function handleUpdate(entryId: string, input: TimelineEntryInput) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              title: input.title,
              description: input.description || null,
              entryTime: input.entryTime || null,
            }
          : e,
      ),
    );
    router.refresh();
  }

  async function handleReorder(entryId: string, direction: "up" | "down") {
    const result = await reorderEntryAction(eventId, entryId, direction);
    if (result.ok) router.refresh();
    else toast.error("Could not reorder entry.");
  }

  // Empty state
  if (sorted.length === 0 && !showAddForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <TemplatePicker
            eventId={eventId}
            eventStartTime={eventStartTime}
            onApplied={() => router.refresh()}
          />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Clock className="h-5 w-5" />
          </span>
          <p className="font-heading text-base font-medium text-heading">No timeline yet</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Build the day-of schedule entry by entry, or start from a template.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button type="button" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add First Entry
            </Button>
            <TemplatePicker
              eventId={eventId}
              eventStartTime={eventStartTime}
              onApplied={() => router.refresh()}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "entry" : "entries"}
        </p>
        <div className="flex items-center gap-2">
          <TemplatePicker
            eventId={eventId}
            eventStartTime={eventStartTime}
            onApplied={() => router.refresh()}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddForm((v) => !v)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Add form (above the list) */}
      {showAddForm && (
        <EntryForm
          initial={{ title: "", description: "", entryTime: "" }}
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          pending={addPending}
          submitLabel="Add"
        />
      )}

      {/* Timeline list */}
      <div>
        {sorted.map((entry, i) => {
          const prev = sorted[i - 1];
          const next = sorted[i + 1];
          const sameAsPrev = !!prev && prev.entryTime === entry.entryTime;
          const sameAsNext = !!next && next.entryTime === entry.entryTime;
          return (
            <TimelineEntryRow
              key={entry.id}
              entry={entry}
              isFirst={i === 0}
              isLast={i === sorted.length - 1}
              sameTimeAsPrev={sameAsPrev}
              sameTimeAsNext={sameAsNext}
              eventStartTime={eventStartTime}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onReorder={handleReorder}
            />
          );
        })}
      </div>
    </div>
  );
}
