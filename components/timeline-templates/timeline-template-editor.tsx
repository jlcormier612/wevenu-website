"use client";

/**
 * Timeline Template item editor — Add/Edit/Delete/Drag-to-reorder on a
 * template's items (Timeline Templates, 2026-07-10). This is a new editor
 * for the new template layer, not a redesign of the existing Booking-level
 * Timeline editor (components/events/timeline/timeline-view.tsx), which
 * this task doesn't touch. Drag-and-drop reuses the same native HTML5
 * primitives as the Pipeline Template stage editor and Pipeline Board — no
 * new dependency.
 *
 * day_offset + day_anchor: templates store a signed relative-day rule
 * (event start or event end). Apply resolves to event_date-relative
 * day_offset on the event schedule; entries clamp with a planning pad.
 */

import * as React from "react";

import { AlertTriangle, GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addItemAction, deleteItemAction, reorderItemsAction, updateItemAction } from "@/app/(app)/timeline-templates/actions";
import { LibrarySaveStatus, useLibrarySaveStatus } from "@/components/library/library-save-status";
import { librarySavedToastMessage, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  INTERNAL_NOTES_PRIVACY_HINT,
  internalNotesLabel,
} from "@/lib/notes/internal-notes-copy";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATE_DAY_OFFSET_MAX,
  TEMPLATE_DAY_OFFSET_OPTIONS,
  VENUE_TIMELINE_AUDIENCES,
  formatTemplateDayLabel,
  sortTimelineTemplateItems,
} from "@/lib/timeline-templates/constants";
import type { TimelineTemplateItem, TimelineTemplateItemInput } from "@/lib/timeline-templates/types";
import type { TimelineAudience } from "@/lib/timeline/types";
import {
  DAY_OF_SCHEDULE_START_LABEL,
  minutesFromRelativeForm,
  previewRelativeClock,
  relativeFormFromMinutes,
  summarizeTemplateItemTiming,
  templateHasConflictingTiming,
  timingModeFromTemplateFields,
  type TimingMode,
  type TimelineDayAnchor,
} from "@/lib/timeline/timing-presentation";

function emptyForm(sortOrder: number): TimelineTemplateItemInput {
  return {
    title: "", description: null, notes: null, timeOfDay: null, minutesOffset: null,
    dayOffset: 0, dayAnchor: "event_start", needsReview: false, audiences: ["client"], sortOrder,
  };
}

function itemToForm(item: TimelineTemplateItem): TimelineTemplateItemInput {
  return {
    title: item.title, description: item.description, notes: item.notes,
    timeOfDay: item.timeOfDay, minutesOffset: item.minutesOffset,
    dayOffset: item.dayOffset ?? 0,
    dayAnchor: item.dayAnchor ?? "event_start",
    needsReview: item.needsReview, audiences: item.audiences, sortOrder: item.sortOrder,
  };
}

function clampTemplateDayOffset(raw: number): number {
  const n = Number.isFinite(raw) ? Math.trunc(raw) : 0;
  return Math.max(-TEMPLATE_DAY_OFFSET_MAX, Math.min(TEMPLATE_DAY_OFFSET_MAX, n));
}

function summarizeTiming(item: TimelineTemplateItem): string | null {
  return summarizeTemplateItemTiming(item);
}

export function TimelineTemplateEditor({ templateId, initialItems }: { templateId: string; initialItems: TimelineTemplateItem[] }) {
  const [items, setItems] = React.useState(() => sortTimelineTemplateItems(initialItems));
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<TimelineTemplateItemInput>(() => emptyForm(0));
  const [timingMode, setTimingMode] = React.useState<TimingMode>("specific");
  const [relDirection, setRelDirection] = React.useState<"before" | "after" | "at">("before");
  const [relMinutes, setRelMinutes] = React.useState(30);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const saveUi = useLibrarySaveStatus();
  const sheetBaseline = React.useRef("");
  const sheetDirty = sheetOpen && JSON.stringify(form) !== sheetBaseline.current;
  const { confirmLeave } = useLibraryUnsavedGuard(sheetDirty);

  function syncTimingUi(next: TimelineTemplateItemInput) {
    const mode = timingModeFromTemplateFields(next.timeOfDay, next.minutesOffset);
    setTimingMode(mode === "untimed" ? "specific" : mode);
    if (next.minutesOffset !== null && next.minutesOffset !== undefined) {
      const rel = relativeFormFromMinutes(next.minutesOffset);
      setRelDirection(rel.direction);
      setRelMinutes(rel.minutes || 30);
    } else {
      setRelDirection("before");
      setRelMinutes(30);
    }
  }

  function applyTimingMode(mode: TimingMode) {
    setTimingMode(mode);
    if (mode === "specific") {
      setForm((p) => ({ ...p, minutesOffset: null }));
    } else if (mode === "relative") {
      setForm((p) => ({
        ...p,
        timeOfDay: null,
        minutesOffset: minutesFromRelativeForm(relDirection, relMinutes),
      }));
    } else {
      setForm((p) => ({ ...p, timeOfDay: null, minutesOffset: null }));
    }
  }

  function applyRelativeFields(direction: "before" | "after" | "at", minutes: number) {
    setRelDirection(direction);
    setRelMinutes(minutes);
    setForm((p) => ({
      ...p,
      timeOfDay: null,
      minutesOffset: minutesFromRelativeForm(direction, minutes),
    }));
  }

  const relativePreview = timingMode === "relative" && form.minutesOffset != null
    ? previewRelativeClock(form.minutesOffset, null)
    : null;
  const legacyConflict = templateHasConflictingTiming(form.timeOfDay, form.minutesOffset);

  const dragIndex = React.useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  function openAdd() {
    setEditingId(null);
    const next = emptyForm(items.length);
    setForm(next);
    syncTimingUi(next);
    sheetBaseline.current = JSON.stringify(next);
    setSheetOpen(true);
  }

  function openEdit(item: TimelineTemplateItem) {
    setEditingId(item.id);
    const next = itemToForm(item);
    setForm(next);
    syncTimingUi(next);
    sheetBaseline.current = JSON.stringify(next);
    setSheetOpen(true);
  }

  function toggleAudience(a: TimelineAudience) {
    setForm((p) => ({
      ...p,
      audiences: p.audiences.includes(a) ? p.audiences.filter((x) => x !== a) : [...p.audiences, a],
    }));
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    // Normalize to one timing mode so apply never sees conflicting fields.
    let timeOfDay = form.timeOfDay;
    let minutesOffset = form.minutesOffset;
    if (timingMode === "specific") {
      minutesOffset = null;
      timeOfDay = timeOfDay && String(timeOfDay).trim() ? timeOfDay : null;
    } else if (timingMode === "relative") {
      timeOfDay = null;
      minutesOffset = minutesFromRelativeForm(relDirection, relMinutes);
    } else {
      timeOfDay = null;
      minutesOffset = null;
    }
    // Saving through this form is itself the review — a coordinator who
    // opened an imported item and clicked Save has looked at its timing,
    // whether or not they changed it. needsReview always clears here.
    const dayOffset = clampTemplateDayOffset(form.dayOffset ?? 0);
    const dayAnchor: TimelineDayAnchor = form.dayAnchor === "event_end" ? "event_end" : "event_start";
    const reviewed = {
      ...form,
      timeOfDay,
      minutesOffset,
      dayOffset,
      dayAnchor,
      needsReview: false,
    };
    if (editingId) {
      const result = await updateItemAction(editingId, templateId, reviewed);
      setSaving(false);
      if (result.ok) {
        setItems((p) => sortTimelineTemplateItems(p
          .map((it) => (it.id === editingId
            ? {
              ...it,
              ...reviewed,
              description: reviewed.description,
              notes: reviewed.notes,
              dayOffset: reviewed.dayOffset ?? 0,
              dayAnchor: reviewed.dayAnchor ?? "event_start",
            }
            : it))).map((it, i) => ({ ...it, sortOrder: i })));
        setSheetOpen(false);
        toast.success(librarySavedToastMessage());
      } else {
        toast.error(result.message ?? "Could not save item.");
      }
    } else {
      const result = await addItemAction(templateId, reviewed);
      setSaving(false);
      if (result.ok && result.itemId) {
        const now = new Date().toISOString();
        setItems((p) => sortTimelineTemplateItems([...p, {
          id: result.itemId!, templateId, venueId: "", title: reviewed.title, description: reviewed.description,
          notes: reviewed.notes, timeOfDay: reviewed.timeOfDay, minutesOffset: reviewed.minutesOffset,
          dayOffset: reviewed.dayOffset ?? 0,
          dayAnchor: reviewed.dayAnchor ?? "event_start",
          needsReview: false,
          audiences: reviewed.audiences, sortOrder: reviewed.sortOrder, createdAt: now, updatedAt: now,
        }]).map((it, i) => ({ ...it, sortOrder: i })));
        setSheetOpen(false);
      } else {
        toast.error((result as { message?: string }).message ?? "Could not add item.");
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    setDeletingId(id);
    const result = await deleteItemAction(id, templateId);
    setDeletingId(null);
    if (result.ok) setItems((p) => p.filter((it) => it.id !== id));
    else toast.error(result.message ?? "Could not delete item.");
  }

  function handleDragStart(index: number) { dragIndex.current = index; }
  function handleDragOver(e: React.DragEvent, index: number) { e.preventDefault(); setDragOverIndex(index); }
  function handleDragEnd() { dragIndex.current = null; setDragOverIndex(null); }
  function handleDrop(index: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);
    if (from === null || from === index) return;
    setItems((p) => {
      const next = [...p];
      const [moved] = next.splice(from, 1);
      if (!moved) return p;
      next.splice(index, 0, moved);
      // Capture drag order as sortOrder first so equal-time / untimed ties keep the
      // intentional override; distinct times still win via chronological compare.
      const dragged = next.map((it, i) => ({ ...it, sortOrder: i }));
      const chrono = sortTimelineTemplateItems(dragged).map((it, i) => ({ ...it, sortOrder: i }));
      const orderChangedFromDrag = chrono.some((it, i) => it.id !== dragged[i]?.id);
      saveUi.markSaving();
      reorderItemsAction(templateId, chrono.map((it) => it.id)).then((result) => {
        if (!result.ok) {
          saveUi.markError();
          toast.error(result.message ?? "Could not save the new order.");
        } else {
          saveUi.markSaved();
          if (orderChangedFromDrag) {
            toast.message("Activities with different times stay in chronological order.");
          }
        }
      });
      return chrono;
    });
  }

  const showDayBadges = items.some(
    (it) => (it.dayOffset ?? 0) !== 0 || (it.dayAnchor ?? "event_start") === "event_end",
  );
  const formDayAnchor: TimelineDayAnchor = form.dayAnchor === "event_end" ? "event_end" : "event_start";
  const formDayPreview = formatTemplateDayLabel(form.dayOffset ?? 0, formDayAnchor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-medium text-heading">Timeline Items</h2>
          <p className="text-xs text-muted-foreground">
            Item edits use Save changes. Activities with times sort chronologically; drag to order matching or untimed activities (saves automatically).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LibrarySaveStatus status={saveUi.status} model="autosave" />
          <Button type="button" size="sm" onClick={openAdd}><Plus className="mr-1.5 h-3.5 w-3.5" />Add Item</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border py-10 text-center">
          <p className="text-sm font-medium text-heading">No items yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add the first item in this timeline.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const timing = summarizeTiming(item);
            const showDayBadge = showDayBadges
              || (item.dayOffset ?? 0) !== 0
              || (item.dayAnchor ?? "event_start") === "event_end";
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`flex items-start gap-3 rounded-sm border bg-card p-3 transition-colors ${
                  item.needsReview ? "border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20" : dragOverIndex === index ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="mt-1 shrink-0 cursor-grab text-muted-foreground" aria-label="Drag to reorder">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {showDayBadge && (
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {formatTemplateDayLabel(item.dayOffset ?? 0, item.dayAnchor ?? "event_start")}
                      </Badge>
                    )}
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    {timing ? (
                      <span className="text-xs text-muted-foreground">{timing}</span>
                    ) : item.needsReview ? null : (
                      <span className="text-xs text-muted-foreground">No timing set</span>
                    )}
                    {item.needsReview && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3" /> Needs timing review
                      </span>
                    )}
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  {item.notes && <p className="text-xs italic text-muted-foreground">Note: {item.notes}</p>}
                  <div className="flex flex-wrap gap-1">
                    {item.audiences.map((a) => {
                      const meta = VENUE_TIMELINE_AUDIENCES.find((t) => t.value === a);
                      return <Badge key={a} variant="outline" className="text-[10px]">{meta?.emoji} {meta?.label ?? a}</Badge>;
                    })}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => openEdit(item)} title="Edit" className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} title="Delete" className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={(next) => {
        if (!next && sheetDirty && !confirmLeave()) return;
        setSheetOpen(next);
      }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingId ? "Edit Item" : "Add Item"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ceremony begins" className="h-9 text-sm" />
            </div>
            <div className="space-y-2" data-testid="timeline-template-day-rule">
              <Label className="text-xs">Which day?</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground" htmlFor="timeline-template-day-anchor">
                    Measured from
                  </Label>
                  <Select
                    value={formDayAnchor}
                    onValueChange={(v) => setForm((p) => ({
                      ...p,
                      dayAnchor: v === "event_end" ? "event_end" : "event_start",
                    }))}
                    items={[
                      { value: "event_start", label: "Event start date" },
                      { value: "event_end", label: "Event end date" },
                    ]}
                  >
                    <SelectTrigger
                      id="timeline-template-day-anchor"
                      className="h-9 text-sm w-full"
                      data-testid="timeline-template-day-anchor"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="event_start">Event start date</SelectItem>
                      <SelectItem value="event_end">Event end date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground" htmlFor="timeline-template-day-offset">
                    Days from that date
                  </Label>
                  <Input
                    id="timeline-template-day-offset"
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={-TEMPLATE_DAY_OFFSET_MAX}
                    max={TEMPLATE_DAY_OFFSET_MAX}
                    className="h-9 text-sm"
                    data-testid="timeline-template-day-offset"
                    value={form.dayOffset ?? 0}
                    onChange={(e) => {
                      const raw = Number.parseInt(e.target.value, 10);
                      setForm((p) => ({
                        ...p,
                        dayOffset: Number.isFinite(raw) ? clampTemplateDayOffset(raw) : 0,
                      }));
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="timeline-template-day-quick">
                {TEMPLATE_DAY_OFFSET_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, dayOffset: d }))}
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                      (form.dayOffset ?? 0) === d
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {d > 0 ? `+${d}` : String(d)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground" data-testid="timeline-template-day-preview">
                {formDayPreview}. Negative = before that date; 0 = on that date; positive = after.
                Event-end anchors need a multi-day event end date when applied (otherwise they fall back to the start date).
              </p>
            </div>

            <div className="space-y-2" data-testid="timeline-template-timing">
              <Label className="text-xs">When does it happen?</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { mode: "specific" as const, label: "Specific time" },
                    { mode: "relative" as const, label: `Relative to ${DAY_OF_SCHEDULE_START_LABEL}` },
                    { mode: "untimed" as const, label: "No time yet" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    data-testid={`timeline-timing-mode-${opt.mode}`}
                    onClick={() => applyTimingMode(opt.mode)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      timingMode === opt.mode
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {legacyConflict ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-foreground" data-testid="timeline-timing-conflict">
                  This item has both a clock time and a relative offset. Saving will keep the mode you select above and clear the other.
                </p>
              ) : null}

              {timingMode === "specific" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Clock time</Label>
                  <Input
                    type="time"
                    value={form.timeOfDay ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, timeOfDay: e.target.value || null, minutesOffset: null }))}
                    className="h-9 text-sm w-40"
                    data-testid="timeline-template-time-of-day"
                  />
                </div>
              ) : null}

              {timingMode === "relative" ? (
                <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                  <p className="text-xs text-foreground">
                    Reference: <span className="font-medium">{DAY_OF_SCHEDULE_START_LABEL}</span>
                    {" "}(the event&apos;s Day-of schedule Start time — not ceremony or reception).
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Minutes</Label>
                      <Input
                        type="number"
                        min={0}
                        value={relDirection === "at" ? 0 : relMinutes}
                        disabled={relDirection === "at"}
                        onChange={(e) => applyRelativeFields(relDirection, Number(e.target.value) || 0)}
                        className="h-9 text-sm w-24"
                        data-testid="timeline-template-rel-minutes"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Direction</Label>
                      <Select
                        value={relDirection}
                        onValueChange={(v) => applyRelativeFields(v as "before" | "after" | "at", relMinutes)}
                        items={[
                          { value: "before", label: "before" },
                          { value: "after", label: "after" },
                          { value: "at", label: "at (same time)" },
                        ]}
                      >
                        <SelectTrigger className="h-9 text-sm w-36" data-testid="timeline-template-rel-direction">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="before">before</SelectItem>
                          <SelectItem value="after">after</SelectItem>
                          <SelectItem value="at">at (same time)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {relativePreview ? (
                    <p className="text-[11px] text-muted-foreground" data-testid="timeline-template-rel-preview">
                      {relativePreview.label} Applied items become a fixed clock time; changing Start later does not recalculate them.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {timingMode === "untimed" ? (
                <p className="text-[11px] text-muted-foreground">
                  No clock time is stored. Set a specific time here or after applying the template to an event.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="min-h-16 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Share with</Label>
              <div className="flex flex-wrap gap-1.5">
                {VENUE_TIMELINE_AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => toggleAudience(a.value)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      form.audiences.includes(a.value) ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{internalNotesLabel("timeline")}</Label>
              <p className="text-[11px] text-muted-foreground">{INTERNAL_NOTES_PRIVACY_HINT}</p>
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="min-h-16 text-sm" placeholder="Operational notes…" />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <LibrarySaveStatus status={saving ? "saving" : sheetDirty ? "dirty" : "idle"} model="explicit" className="mr-auto" />
            <Button type="button" variant="outline" onClick={() => { if (confirmLeave()) setSheetOpen(false); }} disabled={saving}>Cancel</Button>
            <Button type="button" disabled={!form.title.trim() || saving || (editingId != null && !sheetDirty)} onClick={handleSave}>
              {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : editingId ? "Save changes" : "Add Item"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
