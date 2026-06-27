"use client";

import * as React from "react";

import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addPackageItemAction, removePackageItemAction } from "@/app/(app)/packages/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PackageItem } from "@/lib/packages/types";

export function PackageInclusionsEditor({
  packageId,
  initialItems,
}: {
  packageId: string;
  initialItems: PackageItem[];
}) {
  const [items, setItems] = React.useState(initialItems);
  const [showAdd, setShowAdd] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [unit, setUnit] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  function handleAdd() {
    if (!description.trim()) return;
    startAdd(async () => {
      const result = await addPackageItemAction(packageId, { description, quantity, unit });
      if (result.ok && "item" in result) {
        setItems((p) => [...p, result.item]);
        setDescription(""); setQuantity("1"); setUnit(""); setShowAdd(false);
      } else toast.error("message" in result ? result.message ?? "Could not add." : "Could not add.");
    });
  }

  async function handleRemove(itemId: string) {
    setRemovingId(itemId);
    const result = await removePackageItemAction(packageId, itemId);
    setRemovingId(null);
    if (result.ok) setItems((p) => p.filter((i) => i.id !== itemId));
    else toast.error(result.message ?? "Could not remove.");
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground py-2">No inclusions listed yet. Add what's included in this package.</p>
      )}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-2 text-sm">
              <Check className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="flex-1 text-foreground">
                {item.quantity !== 1 && <span className="text-muted-foreground mr-1">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>}
                {item.description}
              </span>
              <button type="button" onClick={() => handleRemove(item.id)} disabled={removingId === item.id}
                className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity" aria-label="Remove">
                {removingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] items-end rounded-lg border border-ring bg-card p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Inclusion *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ceremony space, catering for 150 guests…" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Qty</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-16" min="0" step="1" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unit</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="hours, guests…" className="w-28" />
          </div>
          <div className="flex items-center gap-1.5 sm:col-span-3 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} disabled={addPending}>Cancel</Button>
            <Button type="button" size="sm" disabled={!description.trim() || addPending} onClick={handleAdd}>
              {addPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Adding…</> : <><Check className="mr-1 h-3.5 w-3.5" />Add</>}
            </Button>
          </div>
        </div>
      )}
      {!showAdd && (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Inclusion
        </Button>
      )}
    </div>
  );
}
