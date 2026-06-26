"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addClientNoteAction,
  deleteClientNoteAction,
  updateClientNoteAction,
} from "@/app/(app)/clients/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ClientNote } from "@/lib/clients/types";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ClientNotesSection({ clientId, initialNotes }: { clientId: string; initialNotes: ClientNote[] }) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(initialNotes);
  const [body, setBody] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const [savePending, startSave] = React.useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  function handleAdd() {
    if (!body.trim()) return;
    startAdd(async () => {
      const result = await addClientNoteAction(clientId, body);
      if (result.ok) {
        setNotes((p) => [{ id: crypto.randomUUID(), venueId: "", clientId, body: body.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...p]);
        setBody("");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not add note.");
      }
    });
  }

  function handleSaveEdit(noteId: string) {
    if (!editBody.trim()) return;
    startSave(async () => {
      const result = await updateClientNoteAction(noteId, clientId, editBody);
      if (result.ok) {
        setNotes((p) => p.map((n) => n.id === noteId ? { ...n, body: editBody.trim(), updatedAt: new Date().toISOString() } : n));
        setEditingId(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save note.");
      }
    });
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    setNotes((p) => p.filter((n) => n.id !== noteId));
    const result = await deleteClientNoteAction(noteId);
    setDeletingId(null);
    if (!result.ok) { toast.error(result.message ?? "Could not delete note."); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" rows={3}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(); }} />
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!body.trim() || addPending} onClick={handleAdd}>
            {addPending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </div>
      {notes.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>}
      <div className="space-y-3">
        {notes.map((note) =>
          editingId === note.id ? (
            <div key={note.id} className="rounded-lg border border-ring bg-card p-4 space-y-2">
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} autoFocus
                onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveEdit(note.id); }} />
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={savePending}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button>
                <Button type="button" size="sm" disabled={!editBody.trim() || savePending} onClick={() => handleSaveEdit(note.id)}><Check className="mr-1 h-3.5 w-3.5" />{savePending ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          ) : (
            <div key={note.id} className="group relative rounded-lg border border-border bg-card p-4">
              <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground" title={new Date(note.createdAt).toLocaleString()}>
                  {formatRelative(note.createdAt)}{note.updatedAt !== note.createdAt ? " · edited" : ""}
                </p>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => { setEditingId(note.id); setEditBody(note.body); }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => handleDelete(note.id)} disabled={deletingId === note.id} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
