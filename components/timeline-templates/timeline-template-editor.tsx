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
 * day_offset (2026-08): templates aren't bound to a calendar range, so the
 * Day field uses "Day 1" / "Day 2" labels. Applied bookings clamp against
 * the event's actual end date.
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATE_DAY_OFFSET_OPTIONS,
  VENUE_TIMELINE_AUDIENCES,
  formatTemplateDayLabel,
} from "@/lib/timeline-templates/constants";
import type { TimelineTemplateItem, TimelineTemplateItemInput } from "@/lib/timeline-templates/types";
import type { TimelineAudience } from "@/lib/timeline/types";

function emptyForm(sortOrder: number): TimelineTemplateItemInput {
  return {
    title: "", description: null, notes: null, timeOfDay: null, minutesOffset: null,
    dayOffset: 0, needsReview: false, audiences: ["venue"], sortOrder,
  };
}

function itemToForm(item: TimelineTemplateItem): TimelineTemplateItemInput {
  return {
    title: item.title, description: item.description, notes: item.notes,
    timeOfDay: item.timeOfDay, minutesOffset: item.minutesOffset, dayOffset: item.dayOffset ?? 0,
    needsReview: item.needsReview, audiences: item.audiences, sortOrder: item.sortOrder,
  };
}

function summarizeTiming(item: TimelineTemplateItem): string | null {
  const parts: string[] = [];
  if (item.timeOfDay) parts.push(item.timeOfDay);
  if (item.minutesOffset !== null) {
    parts.push(item.minutesOffset === 0 ? "at event start" : `${item.minutesOffset > 0 ? "+" : ""}${item.minutesOffset} min`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function TimelineTemplateEditor({ templateId, initialItems }: { templateId: string; initialItems: TimelineTemplateItem[] }) {
  const [items, setItems] = React.useState(initialItems);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<TimelineTemplateItemInput>(() => emptyForm(0));
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const saveUi = useLibrarySaveStatus();
  const sheetBaseline = React.useRef("");
  const sheetDirty = sheetOpen && JSON.stringify(form) !== sheetBaseline.current;
  const { confirmLeave } = useLibraryUnsavedGuard(sheetDirty);

  const dragIndex = React.useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const dayOptions = React.useMemo(() => {
    const maxUsed = items.reduce((m, it) => Math.max(m, it.dayOffset ?? 0), 0);
    const max = Math.max(TEMPLATE_DAY_OFFSET_OPTIONS[TEMPLATE_DAY_OFFSET_OPTIONS.length - 1], maxUsed, form.dayOffset ?? 0);
    return Array.from({ length: max + 1 }, (_, i) => i);
  }, [items, form.dayOffset]);

  function openAdd() {
    setEditingId(null);
    const next = emptyForm(items.length);
    setForm(next);
    sheetBaseline.current = JSON.stringify(next);
    setSheetOpen(true);
  }

  function openEdit(item: TimelineTemplateItem) {
    setEditingId(item.id);
    const next = itemToForm(item);
    setForm(next);
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
    // Saving through this form is itself the review — a coordinator who
    // opened an imported item and clicked Save has looked at its timing,
    // whether or not they changed it. needsReview always clears here.
    const reviewed = { ...form, dayOffset: form.dayOffset ?? 0, needsReview: false };
    if (editingId) {
      const result = await updateItemAction(editingId, templateId, reviewed);
      setSaving(false);
      if (result.ok) {
        setItems((p) => p
          .map((it) => (it.id === editingId
            ? { ...it, ...reviewed, description: reviewed.description, notes: reviewed.notes, dayOffset: reviewed.dayOffset ?? 0 }
            : it))
          .sort((a, b) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0) || a.sortOrder - b.sortOrder));
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
        setItems((p) => [...p, {
          id: result.itemId!, templateId, venueId: "", title: reviewed.title, description: reviewed.description,
          notes: reviewed.notes, timeOfDay: reviewed.timeOfDay, minutesOffset: reviewed.minutesOffset,
          dayOffset: reviewed.dayOffset ?? 0, needsReview: false,
          audiences: reviewed.audiences, sortOrder: reviewed.sortOrder, createdAt: now, updatedAt: now,
        }].sort((a, b) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0) || a.sortOrder - b.sortOrder));
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
      next.splice(index, 0, moved);
      saveUi.markSaving();
      reorderItemsAction(templateId, next.map((it) => it.id)).then((result) => {
        if (!result.ok) {
          saveUi.markError();
          toast.error(result.message ?? "Could not save the new order.");
        } else {
          saveUi.markSaved();
        }
      });
      return next;
    });
  }

  const multiDayTemplate = items.some((it) => (it.dayOffset ?? 0) > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-medium text-heading">Timeline Items</h2>
          <p className="text-xs text-muted-foreground">Item edits use Save changes. Reordering saves automatically.</p>
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
            const showDayBadge = multiDayTemplate || (item.dayOffset ?? 0) > 0;
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
                        {formatTemplateDayLabel(item.dayOffset ?? 0)}
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Day</Label>
                <Select
                  value={String(form.dayOffset ?? 0)}
                  onValueChange={(v) => setForm((p) => ({ ...p, dayOffset: Number(v) || 0 }))}
                  items={dayOptions.map((d) => ({ value: String(d), label: formatTemplateDayLabel(d) }))}
                >
                  <SelectTrigger className="h-9 text-sm w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((d) => (
                      <SelectItem key={d} value={String(d)}>{formatTemplateDayLabel(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Time</Label>
                <Input
                  type="time" value={form.timeOfDay ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, timeOfDay: e.target.value || null }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Relative Time (min)</Label>
                <Input
                  type="number" value={form.minutesOffset ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, minutesOffset: e.target.value === "" ? null : Number(e.target.value) }))}
                  placeholder="-30" className="h-9 text-sm"
                />
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-muted-foreground">
              Day is relative to the event start (Day 1 = first calendar day). Relative Time is minutes from the event&apos;s start time (negative = before). Time is an optional fixed clock time.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="min-h-16 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Audience</Label>
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
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="min-h-16 text-sm" placeholder="Internal notes — not shown to guests or clients." />
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
