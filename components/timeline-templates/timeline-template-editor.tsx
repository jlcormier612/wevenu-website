"use client";

/**
 * Timeline Template item editor — Add/Edit/Delete/Drag-to-reorder on a
 * template's items (Timeline Templates, 2026-07-10). This is a new editor
 * for the new template layer, not a redesign of the existing Booking-level
 * Timeline editor (components/events/timeline/timeline-view.tsx), which
 * this task doesn't touch. Drag-and-drop reuses the same native HTML5
 * primitives as the Pipeline Template stage editor and Pipeline Board — no
 * new dependency.
 */

import * as React from "react";

import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addItemAction, deleteItemAction, reorderItemsAction, updateItemAction } from "@/app/(app)/timeline-templates/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TIMELINE_AUDIENCES } from "@/lib/timeline-templates/constants";
import type { TimelineTemplateItem, TimelineTemplateItemInput } from "@/lib/timeline-templates/types";
import type { TimelineAudience } from "@/lib/timeline/types";

function emptyForm(sortOrder: number): TimelineTemplateItemInput {
  return { title: "", description: null, notes: null, timeOfDay: null, minutesOffset: null, audiences: ["internal"], sortOrder };
}

function itemToForm(item: TimelineTemplateItem): TimelineTemplateItemInput {
  return {
    title: item.title, description: item.description, notes: item.notes,
    timeOfDay: item.timeOfDay, minutesOffset: item.minutesOffset,
    audiences: item.audiences, sortOrder: item.sortOrder,
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

  const dragIndex = React.useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm(items.length));
    setSheetOpen(true);
  }

  function openEdit(item: TimelineTemplateItem) {
    setEditingId(item.id);
    setForm(itemToForm(item));
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
    if (editingId) {
      const result = await updateItemAction(editingId, templateId, form);
      setSaving(false);
      if (result.ok) {
        setItems((p) => p.map((it) => (it.id === editingId ? { ...it, ...form, description: form.description, notes: form.notes } : it)));
        setSheetOpen(false);
      } else {
        toast.error(result.message ?? "Could not save item.");
      }
    } else {
      const result = await addItemAction(templateId, form);
      setSaving(false);
      if (result.ok && result.itemId) {
        const now = new Date().toISOString();
        setItems((p) => [...p, {
          id: result.itemId!, templateId, venueId: "", title: form.title, description: form.description,
          notes: form.notes, timeOfDay: form.timeOfDay, minutesOffset: form.minutesOffset,
          audiences: form.audiences, sortOrder: form.sortOrder, createdAt: now, updatedAt: now,
        }]);
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
      reorderItemsAction(templateId, next.map((it) => it.id)).then((result) => {
        if (!result.ok) toast.error(result.message ?? "Could not save the new order.");
      });
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-medium text-heading">Timeline Items</h2>
        <Button type="button" size="sm" onClick={openAdd}><Plus className="mr-1.5 h-3.5 w-3.5" />Add Item</Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm font-medium text-heading">No items yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add the first item in this timeline.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const timing = summarizeTiming(item);
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors ${dragOverIndex === index ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="mt-1 shrink-0 cursor-grab text-muted-foreground" aria-label="Drag to reorder">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    {timing && <span className="text-xs text-muted-foreground">{timing}</span>}
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  {item.notes && <p className="text-xs italic text-muted-foreground">Note: {item.notes}</p>}
                  <div className="flex flex-wrap gap-1">
                    {item.audiences.map((a) => {
                      const meta = TIMELINE_AUDIENCES.find((t) => t.value === a);
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingId ? "Edit Item" : "Add Item"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ceremony begins" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <p className="-mt-2 text-[11px] text-muted-foreground">Relative Time is minutes from the event&apos;s start time (negative = before, 0 = at start). Time is an optional fixed clock time.</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="min-h-16 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Audience</Label>
              <div className="flex flex-wrap gap-1.5">
                {TIMELINE_AUDIENCES.map((a) => (
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
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" disabled={!form.title.trim() || saving} onClick={handleSave}>
              {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : editingId ? "Save Changes" : "Add Item"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
