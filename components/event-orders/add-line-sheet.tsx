"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  addCustomLineAction, addLineFromInventoryAction, addLineFromPackageAction,
} from "@/app/(app)/events/[id]/event-order-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/event-orders/constants";
import type { EventOrderLine } from "@/lib/event-orders/types";
import type { InventoryItem } from "@/lib/inventory/types";
import type { Package } from "@/lib/packages/types";

type Source = "package" | "inventory" | "custom";

/**
 * Package seeding produces one bundled line at packages.base_price — the
 * roadmap's own Phase 2 scope. Per-item itemized pricing is Phase 6, not
 * built here. Inventory-referenced lines require a manually-typed price in
 * this phase too, for the same reason (no smart pre-fill from a catalog
 * rate yet) — see docs/booking-financial-architecture-phase2-implementation
 * .md for why this is a deliberate scoping line, not an oversight.
 */
export function AddLineSheet({
  eventOrderId, eventId, sectionId, packages, inventoryItems, onAdded,
}: {
  eventOrderId: string; eventId: string; sectionId: string | null;
  packages: Package[]; inventoryItems: InventoryItem[];
  onAdded: (line: EventOrderLine) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<Source | null>(null);
  const [packageId, setPackageId] = React.useState("");
  const [inventoryItemId, setInventoryItemId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function reset() {
    setSource(null); setPackageId(""); setInventoryItemId("");
    setDescription(""); setQuantity("1"); setUnitPrice(""); setError("");
  }

  function handlePickInventoryItem(id: string) {
    const item = inventoryItems.find((i) => i.id === id);
    setInventoryItemId(id);
    setDescription(item?.printableName || item?.name || "");
  }

  function handleAdd() {
    startTransition(async () => {
      if (source === "package") {
        const pkg = packages.find((p) => p.id === packageId);
        if (!pkg) { setError("Choose a package."); return; }
        const result = await addLineFromPackageAction(eventOrderId, eventId, pkg.id, pkg.name, pkg.basePrice, sectionId);
        if (result.ok) { onAdded(result.line); toast.success("Added to Event Order."); setOpen(false); reset(); }
        else { setError(result.message ?? "Could not add."); toast.error(result.message ?? "Could not add."); }
        return;
      }
      if (source === "inventory") {
        const result = await addLineFromInventoryAction(eventOrderId, eventId, {
          inventoryItemId, description, quantity, unitPrice, sectionId,
        });
        if (result.ok) { onAdded(result.line); toast.success("Added to Event Order."); setOpen(false); reset(); }
        else { setError(result.message ?? "Could not add."); toast.error(result.message ?? "Could not add."); }
        return;
      }
      if (source === "custom") {
        const result = await addCustomLineAction(eventOrderId, eventId, { description, quantity, unitPrice, sectionId });
        if (result.ok) { onAdded(result.line); toast.success("Added to Event Order."); setOpen(false); reset(); }
        else { setError(result.message ?? "Could not add."); toast.error(result.message ?? "Could not add."); }
      }
    });
  }

  const canSubmit =
    (source === "package" && !!packageId) ||
    (source === "inventory" && !!inventoryItemId && description.trim() && quantity.trim() && unitPrice.trim()) ||
    (source === "custom" && description.trim() && quantity.trim() && unitPrice.trim());

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        + Add Line
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Add to Event Order</SheetTitle>
          <p className="text-sm text-muted-foreground">What is this event going to receive?</p>
        </SheetHeader>

        <div className="space-y-3">
          {packages.length > 0 && (
            <button type="button" onClick={() => setSource("package")}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${source === "package" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}>
              <p className="font-medium text-foreground">From a package</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Seeds one line at the package&apos;s price.</p>
              {source === "package" && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                  {packages.filter((p) => p.isActive).map((p) => (
                    <button key={p.id} type="button" onClick={() => setPackageId(p.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${packageId === p.id ? "border-primary bg-primary/10 font-medium" : "border-border hover:border-primary/40"}`}>
                      {p.name} — {formatMoney(p.basePrice)}
                    </button>
                  ))}
                </div>
              )}
            </button>
          )}

          {inventoryItems.length > 0 && (
            <button type="button" onClick={() => setSource("inventory")}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${source === "inventory" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}>
              <p className="font-medium text-foreground">From inventory</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Pick a real item, confirm quantity and price.</p>
              {source === "inventory" && (
                <div className="mt-3 space-y-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1.5">
                    {inventoryItems.filter((i) => !i.isArchived).map((i) => (
                      <button key={i.id} type="button" onClick={() => handlePickInventoryItem(i.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${inventoryItemId === i.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/40"}`}>
                        {i.name}
                      </button>
                    ))}
                  </div>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="h-8 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" className="h-8 text-sm" />
                    <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Unit price" className="h-8 text-sm" />
                  </div>
                </div>
              )}
            </button>
          )}

          <button type="button" onClick={() => setSource("custom")}
            className={`w-full rounded-xl border p-4 text-left transition-colors ${source === "custom" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}>
            <p className="font-medium text-foreground">Custom line</p>
            <p className="mt-0.5 text-sm text-muted-foreground">A one-off inclusion with no catalog behind it.</p>
            {source === "custom" && (
              <div className="mt-3 space-y-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="h-8 text-sm" autoFocus />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" className="h-8 text-sm" />
                  <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Unit price" className="h-8 text-sm" />
                </div>
              </div>
            )}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!canSubmit || pending} onClick={handleAdd}>
            {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Adding…</> : "Add"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
