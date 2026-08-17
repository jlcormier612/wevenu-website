"use client";

import * as React from "react";

import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { updateInventoryTemplateItemAction } from "@/app/(app)/events/[id]/event-inventory-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryItemInput, InventoryTemplateItem } from "@/lib/event-inventory/types";

/**
 * Edit sheet for an existing template item. Same field set and "Included in
 * the base package (not an extra cost)" language already used for this item
 * shape (components/event-inventory/item-sheet.tsx, Event Inventory's
 * equivalent edit sheet) and the Add Item form on this same screen
 * (inventory-template-detail.tsx's AddTemplateItemInline). Templates are
 * snapshots (D5 brief §7) — editing here only ever touches this template's
 * own row, never any inventory_items or event data it may have originated
 * from or been copied into.
 */
export function TemplateItemEditSheet({
  templateId, item, onPersist,
}: {
  templateId: string;
  item: InventoryTemplateItem;
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(item.name);
  const [category, setCategory] = React.useState(item.category ?? "");
  const [quantity, setQuantity] = React.useState(String(item.quantity));
  const [unitPrice, setUnitPrice] = React.useState(item.unitPrice != null ? String(item.unitPrice) : "");
  const [isIncluded, setIsIncluded] = React.useState(item.isIncluded);
  const [notes, setNotes] = React.useState(item.notes ?? "");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function reset() {
    setName(item.name);
    setCategory(item.category ?? "");
    setQuantity(String(item.quantity));
    setUnitPrice(item.unitPrice != null ? String(item.unitPrice) : "");
    setIsIncluded(item.isIncluded);
    setNotes(item.notes ?? "");
    setError("");
  }

  function handleSubmit() {
    if (!name.trim()) { setError("Name is required."); return; }
    const input: InventoryItemInput = {
      inventoryItemId: item.inventoryItemId, name, category, quantity, unitPrice, isIncluded, notes,
    };
    startTransition(async () => {
      onPersist("saving");
      const result = await updateInventoryTemplateItemAction(templateId, item.id, input, item.updatedAt);
      if (result.ok) {
        onPersist("saved");
        setOpen(false);
      } else if (result.reason === "stale") {
        const message = result.message ?? "Someone else updated this item — refresh and try again.";
        onPersist("error", message);
        toast.error(message, { duration: 6000 });
        setOpen(false);
      } else {
        onPersist("error", result.message);
        setError(result.message ?? "Could not update item.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <SheetTrigger render={<Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100" aria-label="Edit item" />}>
        <Pencil className="h-3.5 w-3.5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Edit Item</SheetTitle>
          <p className="text-sm text-muted-foreground">What&apos;s part of this template?</p>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chiavari chairs" autoFocus />
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
              <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Included at no charge" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id={`tmpl-item-included-${item.id}`} checked={isIncluded} onCheckedChange={(v) => setIsIncluded(v === true)} />
            <Label htmlFor={`tmpl-item-included-${item.id}`} className="text-sm font-normal text-foreground cursor-pointer">
              Included in the base package (not an extra cost)
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
            {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
