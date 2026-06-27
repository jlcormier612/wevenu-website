"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  createSpaceAction,
  deleteSpaceAction,
  updateSpaceAction,
} from "@/app/(app)/availability/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SpaceInput, VenueSpace } from "@/lib/availability/types";

function SpaceForm({
  initial,
  onSave,
  onCancel,
  pending,
  submitLabel,
}: {
  initial: SpaceInput;
  onSave: (input: SpaceInput) => void;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
}) {
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description);
  const [capacity, setCapacity] = React.useState(initial.capacity);
  const [isActive, setIsActive] = React.useState(initial.isActive);
  return (
    <div className="space-y-3 rounded-xl border border-ring bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Space name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Hall, Garden, Barn…" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Capacity <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="200" className="w-32" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this space…" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <Label className="text-xs cursor-pointer">Active (available for booking)</Label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!name.trim() || pending}
          onClick={() => onSave({ name, description, capacity, isActive })}>
          {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function VenueSpacesSection({ initialSpaces }: { initialSpaces: VenueSpace[] }) {
  const router = useRouter();
  const [spaces, setSpaces] = React.useState(initialSpaces);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [addPending, startAdd] = React.useTransition();
  const [editPending, startEdit] = React.useTransition();

  function handleAdd(input: SpaceInput) {
    startAdd(async () => {
      const result = await createSpaceAction(input);
      if (result.ok) {
        setSpaces((p) => [...p, { id: result.spaceId, venueId: "", name: input.name.trim(), description: input.description || null, capacity: input.capacity ? parseInt(input.capacity) : null, isActive: input.isActive, sortOrder: p.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
        setShowAdd(false);
        router.refresh();
      } else toast.error(result.message ?? "Could not add space.");
    });
  }

  function handleEdit(spaceId: string, input: SpaceInput) {
    startEdit(async () => {
      const result = await updateSpaceAction(spaceId, input);
      if (result.ok) {
        setSpaces((p) => p.map((s) => s.id === spaceId ? { ...s, name: input.name.trim(), description: input.description || null, capacity: input.capacity ? parseInt(input.capacity) : null, isActive: input.isActive } : s));
        setEditingId(null);
        router.refresh();
      } else toast.error(result.message ?? "Could not update space.");
    });
  }

  async function handleDelete(spaceId: string, name: string) {
    if (!confirm(`Remove "${name}" from your spaces? Events assigned to this space will become unassigned.`)) return;
    setSpaces((p) => p.filter((s) => s.id !== spaceId));
    const result = await deleteSpaceAction(spaceId);
    if (!result.ok) { toast.error(result.message ?? "Could not delete space."); router.refresh(); }
  }

  return (
    <div className="space-y-3">
      {spaces.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground py-2">No spaces defined. Add your event spaces to enable space-based scheduling.</p>
      )}
      <div className="space-y-2">
        {spaces.map((space) =>
          editingId === space.id ? (
            <SpaceForm
              key={space.id}
              initial={{ name: space.name, description: space.description ?? "", capacity: space.capacity != null ? String(space.capacity) : "", isActive: space.isActive }}
              onSave={(input) => handleEdit(space.id, input)}
              onCancel={() => setEditingId(null)}
              pending={editPending}
              submitLabel="Save"
            />
          ) : (
            <div key={space.id} className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className={`text-sm font-medium ${space.isActive ? "text-foreground" : "text-muted-foreground line-through"}`}>{space.name}</p>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  {space.capacity != null && <span>{space.capacity.toLocaleString()} guests max</span>}
                  {space.description && <span>{space.description}</span>}
                  {!space.isActive && <span className="text-destructive font-medium">Inactive</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => setEditingId(space.id)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => handleDelete(space.id, space.name)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )
        )}
      </div>
      {showAdd ? (
        <SpaceForm initial={{ name: "", description: "", capacity: "", isActive: true }} onSave={handleAdd} onCancel={() => setShowAdd(false)} pending={addPending} submitLabel="Add Space" />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Space
        </Button>
      )}
    </div>
  );
}
