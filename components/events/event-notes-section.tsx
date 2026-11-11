"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addEventNoteAction,
  deleteEventNoteAction,
  updateEventNoteAction,
} from "@/app/(app)/events/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import { INTERNAL_NOTES_PRIVACY_HINT } from "@/lib/notes/internal-notes-copy";
import {
  formatInternalNoteOccurredOn,
  type InternalNoteRollupItem,
} from "@/lib/notes/internal-notes-rollup";

export function EventNotesSection({
  eventId,
  items: initialItems,
  venueTimezone = null,
}: {
  eventId: string;
  items: InternalNoteRollupItem[];
  venueTimezone?: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useSyncedState(initialItems);
  const [body, setBody] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const [savePending, startSave] = React.useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  function handleAdd() {
    if (!body.trim()) return;
    startAdd(async () => {
      const result = await addEventNoteAction(eventId, body);
      if (result.ok) {
        setBody("");
        router.refresh();
      } else toast.error(result.message ?? "Could not add note.");
    });
  }

  function handleSaveEdit(note: InternalNoteRollupItem) {
    if (!editBody.trim() || note.kind !== "event_note") return;
    startSave(async () => {
      const result = await updateEventNoteAction(note.sourceId, eventId, editBody);
      if (result.ok) {
        setItems((p) => p.map((n) => n.id === note.id ? { ...n, body: editBody.trim(), edited: true } : n));
        setEditingId(null);
        router.refresh();
      } else toast.error(result.message ?? "Could not save note.");
    });
  }

  async function handleDelete(note: InternalNoteRollupItem) {
    if (note.kind !== "event_note") return;
    setDeletingId(note.id);
    setItems((p) => p.filter((n) => n.id !== note.id));
    const result = await deleteEventNoteAction(note.sourceId);
    setDeletingId(null);
    if (!result.ok) { toast.error("Could not delete note."); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {INTERNAL_NOTES_PRIVACY_HINT}
      </p>
      <div className="space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" rows={3}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(); }} />
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!body.trim() || addPending} onClick={handleAdd}>
            {addPending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </div>
      {items.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No notes yet. Add one above.</p>}
      <div className="space-y-3">
        {items.map((note) =>
          editingId === note.id ? (
            <div key={note.id} className="rounded-lg border border-ring bg-card p-4 space-y-2">
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} autoFocus
                onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveEdit(note); }} />
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={savePending}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button>
                <Button type="button" size="sm" disabled={!editBody.trim() || savePending} onClick={() => handleSaveEdit(note)}><Check className="mr-1 h-3.5 w-3.5" />{savePending ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          ) : (
            <div key={note.id} className="group relative rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground" title={new Date(note.occurredAt).toLocaleString()}>
                {formatInternalNoteOccurredOn(note.occurredAt, venueTimezone)} · {note.provenanceLabel}
                {note.edited ? " · edited" : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
              {(note.canEdit || note.canDelete) && (
                <div className="mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {note.canEdit && (
                    <button type="button" onClick={() => { setEditingId(note.id); setEditBody(note.body); }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                  )}
                  {note.canDelete && (
                    <button type="button" onClick={() => handleDelete(note)} disabled={deletingId === note.id} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
