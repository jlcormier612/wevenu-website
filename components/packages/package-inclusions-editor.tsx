"use client";

import * as React from "react";

import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addPackageItemAction, linkPackageItemOfferingAction, removePackageItemAction } from "@/app/(app)/packages/actions";
import { LibrarySaveStatus, useLibrarySaveStatus } from "@/components/library/library-save-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type { OfferingWithCategory } from "@/lib/offerings/types";
import type { PackageItem } from "@/lib/packages/types";

function offeringOptionLabel(o: OfferingWithCategory): string {
  return [
    o.parentOfferingName ? `${o.parentOfferingName} › ${o.name}` : o.name,
    o.categoryName ?? "uncategorized",
    o.defaultUnitPrice != null ? `$${o.defaultUnitPrice.toFixed(2)}` : "unpriced",
  ].join(" · ");
}

function OfferingOptions({ offerings, current }: { offerings: OfferingWithCategory[]; current?: string | null }) {
  return (
    <>
      {offerings
        .filter((o) => !o.isArchived || o.id === current)
        .map((o) => (
          <option key={o.id} value={o.id}>
            {offeringOptionLabel(o)}{o.isArchived ? " · archived" : ""}
          </option>
        ))}
    </>
  );
}

export function PackageInclusionsEditor({
  packageId,
  initialItems,
  offerings = [],
}: {
  packageId: string;
  initialItems: PackageItem[];
  offerings?: OfferingWithCategory[];
}) {
  // See lib/hooks/use-synced-state.ts — PackageForm is an always-mounted
  // sibling on this same page and calls router.refresh() on save.
  const [items, setItems] = useSyncedState(initialItems);
  const [showAdd, setShowAdd] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [unit, setUnit] = React.useState("");
  const [offeringId, setOfferingId] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [linkingId, setLinkingId] = React.useState<string | null>(null);
  const saveUi = useLibrarySaveStatus();

  function chooseNewOffering(id: string) {
    setOfferingId(id);
    const o = offerings.find((x) => x.id === id);
    if (!o) return;
    if (!description.trim()) setDescription(o.name);
    if (!unit.trim() && o.unit) setUnit(o.unit);
  }

  function handleAdd() {
    if (!description.trim()) return;
    startAdd(async () => {
      saveUi.markSaving();
      const result = await addPackageItemAction(packageId, { description, quantity, unit, offeringId: offeringId || null });
      if (result.ok && "item" in result) {
        setItems((p) => [...p, result.item]);
        setDescription(""); setQuantity("1"); setUnit(""); setOfferingId(""); setShowAdd(false);
        saveUi.markSaved();
      } else {
        saveUi.markError();
        toast.error("message" in result ? result.message ?? "Could not add." : "Could not add.");
      }
    });
  }

  async function handleLink(itemId: string, nextOfferingId: string) {
    setLinkingId(itemId);
    saveUi.markSaving();
    const result = await linkPackageItemOfferingAction(packageId, itemId, nextOfferingId || null);
    setLinkingId(null);
    if (result.ok && "item" in result) {
      setItems((p) => p.map((i) => (i.id === itemId ? result.item : i)));
      saveUi.markSaved();
    } else {
      saveUi.markError();
      toast.error("message" in result ? result.message ?? "Could not link." : "Could not link.");
    }
  }

  async function handleRemove(itemId: string) {
    setRemovingId(itemId);
    saveUi.markSaving();
    const result = await removePackageItemAction(packageId, itemId);
    setRemovingId(null);
    if (result.ok) {
      setItems((p) => p.filter((i) => i.id !== itemId));
      saveUi.markSaved();
    } else {
      saveUi.markError();
      toast.error(result.message ?? "Could not remove.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Inclusions save as soon as you add, link, or remove them.</p>
        <LibrarySaveStatus status={saveUi.status} model="autosave" />
      </div>
      {offerings.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="package-inclusion-offering-hint">
          Link an inclusion to a catalog offering so it carries onto the Event Order as that offering when this package is accepted.
        </p>
      )}
      {items.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground py-2">No inclusions listed yet. Add what&apos;s included in this package.</p>
      )}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="group flex flex-wrap items-center gap-2 text-sm" data-testid={`package-inclusion-${item.id}`}>
              <Check className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="min-w-[10rem] flex-1 text-foreground">
                {item.quantity !== 1 && <span className="text-muted-foreground mr-1">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>}
                {item.description}
              </span>
              {offerings.length > 0 && (
                <select
                  aria-label={`Catalog offering for ${item.description}`}
                  className="h-8 max-w-[18rem] rounded-md border border-border bg-background px-2 text-xs"
                  value={item.offeringId ?? ""}
                  disabled={linkingId === item.id}
                  data-testid={`package-inclusion-offering-${item.id}`}
                  onChange={(e) => void handleLink(item.id, e.target.value)}
                >
                  <option value="">Not linked to an offering</option>
                  <OfferingOptions offerings={offerings} current={item.offeringId} />
                </select>
              )}
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
          {offerings.length > 0 && (
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs">Catalog offering (optional)</Label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={offeringId}
                data-testid="package-inclusion-new-offering"
                onChange={(e) => chooseNewOffering(e.target.value)}
              >
                <option value="">Not linked to an offering</option>
                <OfferingOptions offerings={offerings} />
              </select>
            </div>
          )}
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
              {addPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : <><Check className="mr-1 h-3.5 w-3.5" />Add</>}
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
