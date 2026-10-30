"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  addEventInventoryItemAction, updateEventInventoryItemAction,
} from "@/app/(app)/events/[id]/event-inventory-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { EventInventoryItem, InventoryItemInput } from "@/lib/event-inventory/types";
import type { InventoryItem } from "@/lib/inventory/types";

/**
 * One sheet, two modes — add a new item, or edit an existing one
 * (expectedUpdatedAt carried for the D5 concurrency check, same shape as
 * D4's Contract editor). The Master Catalog picker only pre-fills
 * name/category — there's no catalog price to pull from (confirmed
 * absent from inventory_items), so price is always typed here, same as
 * Event Order's own Add-from-Inventory flow already requires.
 */
export function ItemSheet({
  eventInventoryId, eventId, catalogItems, existingItem,
}: {
  eventInventoryId: string;
  eventId: string;
  catalogItems: InventoryItem[];
  existingItem?: EventInventoryItem;
}) {
  const router = useRouter();
  const isEdit = !!existingItem;
  const [open, setOpen] = React.useState(false);
  const [catalogItemId, setCatalogItemId] = React.useState(existingItem?.inventoryItemId ?? "");
  const [name, setName] = React.useState(existingItem?.name ?? "");
  const [category, setCategory] = React.useState(existingItem?.category ?? "");
  const [quantity, setQuantity] = React.useState(String(existingItem?.quantity ?? 1));
  const [unitPrice, setUnitPrice] = React.useState(existingItem?.unitPrice != null ? String(existingItem.unitPrice) : "");
  const [isIncluded, setIsIncluded] = React.useState(existingItem?.isIncluded ?? true);
  const [venueOnly, setVenueOnly] = React.useState(existingItem ? !existingItem.clientVisible : false);
  const [notes, setNotes] = React.useState(existingItem?.notes ?? "");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  // Keep local form fields in sync when the parent refreshes after save.
  React.useEffect(() => {
    if (!open) return;
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset reads latest existingItem
  }, [existingItem?.id, existingItem?.updatedAt, existingItem?.unitPrice, existingItem?.isIncluded, existingItem?.clientVisible, open]);

  function reset() {
    setCatalogItemId(existingItem?.inventoryItemId ?? ""); setName(existingItem?.name ?? "");
    setCategory(existingItem?.category ?? ""); setQuantity(String(existingItem?.quantity ?? 1));
    setUnitPrice(existingItem?.unitPrice != null ? String(existingItem.unitPrice) : "");
    setIsIncluded(existingItem?.isIncluded ?? true); setVenueOnly(existingItem ? !existingItem.clientVisible : false);
    setNotes(existingItem?.notes ?? ""); setError("");
  }

  function handlePickCatalog(id: string) {
    const item = catalogItems.find((i) => i.id === id);
    setCatalogItemId(id);
    if (item) setName(item.printableName || item.name);
  }

  function handleSubmit() {
    if (!name.trim()) { setError("Name is required."); return; }
    const input: InventoryItemInput = {
      inventoryItemId: catalogItemId || null, name, category, quantity, unitPrice, isIncluded,
      clientVisible: !venueOnly, notes,
    };
    startTransition(async () => {
      if (isEdit && existingItem) {
        const result = await updateEventInventoryItemAction(eventInventoryId, eventId, existingItem.id, input, existingItem.updatedAt);
        if (result.ok) {
          toast.success("Item updated.");
          setOpen(false);
          router.refresh();
        } else if (result.reason === "stale") {
          toast.error(result.message ?? "Someone else updated this item — refresh and try again.", { duration: 6000 });
          setOpen(false);
          router.refresh();
        } else {
          setError(result.message ?? "Could not update item.");
        }
      } else {
        const result = await addEventInventoryItemAction(eventInventoryId, eventId, input);
        if (result.ok) {
          toast.success("Item added.");
          setOpen(false);
          reset();
          router.refresh();
        } else {
          setError(result.message ?? "Could not add item.");
        }
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      {isEdit ? (
        <SheetTrigger render={<Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100" aria-label="Edit item" />}>
          <Pencil className="h-3.5 w-3.5" />
        </SheetTrigger>
      ) : (
        <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
          + Add Item
        </SheetTrigger>
      )}
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{isEdit ? "Edit Item" : "Add Item"}</SheetTitle>
          <p className="text-sm text-muted-foreground">What's part of this event?</p>
        </SheetHeader>

        <div className="space-y-4">
          {!isEdit && catalogItems.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-heading">From your catalog (optional)</Label>
              <div className="flex flex-wrap gap-1.5">
                {catalogItems.filter((i) => !i.isArchived).map((i) => (
                  <button key={i.id} type="button" onClick={() => handlePickCatalog(i.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${catalogItemId === i.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/40"}`}>
                    {i.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chiavari chairs" autoFocus={!isEdit} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Seating, Decor, Bar…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-heading">Quantity</Label>
              <Input type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-heading">Price each</Label>
              <Input
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="Optional"
                inputMode="decimal"
                data-testid="inventory-item-price-input"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Optional configured price for this event item. Separate from whether it is included in the package (no extra charge) or billed as additional.
          </p>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is-included"
              checked={isIncluded}
              onCheckedChange={(v) => setIsIncluded(v === true)}
              data-testid="inventory-item-included-checkbox"
            />
            <Label htmlFor="is-included" className="text-sm font-normal text-foreground cursor-pointer">
              Included in the base package (not an extra cost)
            </Label>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="is-venue-only"
              checked={venueOnly}
              onCheckedChange={(v) => setVenueOnly(v === true)}
              data-testid="inventory-item-venue-only-checkbox"
            />
            <Label htmlFor="is-venue-only" className="text-sm font-normal text-foreground cursor-pointer">
              Venue only — counted for your team, never shown to the couple, added to the Event Order, or billed
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Color, placement, anything the team should know…" />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!name.trim() || pending} onClick={handleSubmit}>
            {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : isEdit ? "Save" : "Add"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
