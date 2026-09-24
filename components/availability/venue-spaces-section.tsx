"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createSpaceAction,
  deleteSpaceAction,
  updateSpaceAction,
  updateSpaceOperatingModeAction,
} from "@/app/(app)/availability/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type { SpaceInput, VenueSpace } from "@/lib/availability/types";
import { customUseKeyFromLabel, SUGGESTED_SPACE_USES } from "@/lib/venue-spaces/uses";

function SpaceForm({
  initial,
  onSave,
  onCancel,
  pending,
  submitLabel,
  showUses,
}: {
  initial: SpaceInput;
  onSave: (input: SpaceInput) => void;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
  showUses: boolean;
}) {
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description);
  const [capacity, setCapacity] = React.useState(initial.capacity);
  const [isActive, setIsActive] = React.useState(initial.isActive);
  const [permittedUses, setPermittedUses] = React.useState<string[]>(initial.permittedUses ?? []);
  const [customUse, setCustomUse] = React.useState("");

  function toggleUse(key: string) {
    setPermittedUses((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function addCustomUse() {
    const key = customUseKeyFromLabel(customUse);
    if (!key) return;
    setPermittedUses((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setCustomUse("");
  }

  const extraUses = permittedUses.filter(
    (k) => !SUGGESTED_SPACE_USES.some((u) => u.key === k),
  );

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
      {showUses && (
        <div className="space-y-2">
          <Label className="text-xs">Permitted uses</Label>
          <p className="text-xs text-muted-foreground">
            What can happen in this physical space. A space can support more than one use.
            Leave empty if any use is allowed.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_SPACE_USES.map((u) => {
              const on = permittedUses.includes(u.key);
              return (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => toggleUse(u.key)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    on ? "border-ring bg-muted text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {u.label}
                </button>
              );
            })}
            {extraUses.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleUse(key)}
                className="rounded-md border border-ring bg-muted px-2.5 py-1 text-xs text-foreground"
              >
                {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} ×
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={customUse}
              onChange={(e) => setCustomUse(e.target.value)}
              placeholder="Add a custom use…"
              className="h-8 max-w-xs text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomUse();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={!customUse.trim()} onClick={addCustomUse}>
              Add use
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <Label className="text-xs cursor-pointer">Active (available for booking)</Label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!name.trim() || pending}
          onClick={() => onSave({ name, description, capacity, isActive, permittedUses: showUses ? permittedUses : [] })}>
          {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function VenueSpacesSection({
  initialSpaces,
  spaceOperatingMode = "single",
}: {
  initialSpaces: VenueSpace[];
  spaceOperatingMode?: "single" | "multi";
}) {
  const router = useRouter();
  const [spaces, setSpaces] = useSyncedState(initialSpaces);
  const [mode, setMode] = useSyncedState(spaceOperatingMode);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [addPending, startAdd] = React.useTransition();
  const [editPending, startEdit] = React.useTransition();
  const [modePending, startMode] = React.useTransition();
  const showUses = mode === "multi";

  function handleModeChange(next: "single" | "multi") {
    startMode(async () => {
      const result = await updateSpaceOperatingModeAction(next);
      if (result.ok) {
        setMode(next);
        toast.success(next === "multi" ? "Multi-space mode enabled." : "Single-space mode enabled.");
        router.refresh();
      } else toast.error(result.message ?? "Could not update space mode.");
    });
  }

  function handleAdd(input: SpaceInput) {
    startAdd(async () => {
      const result = await createSpaceAction(input);
      if (result.ok) {
        setSpaces((p) => [...p, {
          id: result.spaceId,
          venueId: "",
          name: input.name.trim(),
          description: input.description || null,
          capacity: input.capacity ? parseInt(input.capacity) : null,
          permittedUses: input.permittedUses ?? [],
          isActive: input.isActive,
          sortOrder: p.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]);
        setShowAdd(false);
        toast.success("Event space saved.");
        router.refresh();
      } else toast.error(result.message ?? "Could not add space.");
    });
  }

  function handleEdit(spaceId: string, input: SpaceInput) {
    startEdit(async () => {
      const result = await updateSpaceAction(spaceId, input);
      if (result.ok) {
        setSpaces((p) => p.map((s) => s.id === spaceId ? {
          ...s,
          name: input.name.trim(),
          description: input.description || null,
          capacity: input.capacity ? parseInt(input.capacity) : null,
          permittedUses: input.permittedUses ?? [],
          isActive: input.isActive,
        } : s));
        setEditingId(null);
        toast.success("Event space saved.");
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
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-heading">How this venue uses spaces</p>
          <p className="text-xs text-muted-foreground mt-1">
            Choose whether you operate one primary event space or across multiple physical spaces.
            Only multi-space venues see use-based assignment and calendar space filters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "single" ? "default" : "outline"}
            disabled={modePending}
            onClick={() => handleModeChange("single")}
          >
            One primary space
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "multi" ? "default" : "outline"}
            disabled={modePending}
            onClick={() => handleModeChange("multi")}
          >
            Multiple physical spaces
          </Button>
        </div>
      </div>

      {spaces.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground py-2">
          No Event Spaces yet. Venues that host more than one event at the same time must add at least one Event Space before overlapping events can be booked.
        </p>
      )}
      <div className="space-y-2">
        {spaces.map((space) =>
          editingId === space.id ? (
            <SpaceForm
              key={space.id}
              initial={{
                name: space.name,
                description: space.description ?? "",
                capacity: space.capacity != null ? String(space.capacity) : "",
                isActive: space.isActive,
                permittedUses: space.permittedUses ?? [],
              }}
              onSave={(input) => handleEdit(space.id, input)}
              onCancel={() => setEditingId(null)}
              pending={editPending}
              submitLabel="Save"
              showUses={showUses}
            />
          ) : (
            <div key={space.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className={`text-sm font-medium ${space.isActive ? "text-foreground" : "text-muted-foreground line-through"}`}>{space.name}</p>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  {space.capacity != null && <span>{space.capacity.toLocaleString()} guests max</span>}
                  {space.description && <span>{space.description}</span>}
                  {!space.isActive && <span className="text-destructive font-medium">Inactive</span>}
                </div>
                {showUses && (
                  <p className="text-xs text-muted-foreground">
                    {space.permittedUses.length > 0
                      ? `Uses: ${space.permittedUses
                          .map((k) => SUGGESTED_SPACE_USES.find((u) => u.key === k)?.label ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
                          .join(", ")}`
                      : "Uses: any (not restricted)"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(space.id)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <button type="button" onClick={() => handleDelete(space.id, space.name)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        )}
      </div>
      {showAdd ? (
        <SpaceForm
          initial={{ name: "", description: "", capacity: "", isActive: true, permittedUses: [] }}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          pending={addPending}
          submitLabel="Add Space"
          showUses={showUses}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Space
        </Button>
      )}
    </div>
  );
}
