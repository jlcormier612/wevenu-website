"use client";

import * as React from "react";

import Link from "next/link";
import { toast } from "sonner";

import {
  createOfferingAction, createOfferingCategoryAction, setOfferingArchivedAction, updateOfferingAction,
} from "@/app/(app)/library/offerings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatOptionalMoney } from "@/lib/event-orders/constants";
import type { InventoryItem } from "@/lib/inventory/types";
import type { OfferingCategory, OfferingInput, OfferingWithCategory } from "@/lib/offerings/types";

export function OfferingsLibrarySection({
  initialOfferings, categories, inventoryItems,
}: {
  initialOfferings: OfferingWithCategory[];
  categories: OfferingCategory[];
  inventoryItems: InventoryItem[];
}) {
  const [offerings, setOfferings] = React.useState(initialOfferings);
  const [cats, setCats] = React.useState(categories);
  const [editing, setEditing] = React.useState<OfferingWithCategory | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);

  const visible = offerings.filter((o) => showArchived || !o.isArchived);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Menus, bar, services, and rentals you provide. Distinct from physical Inventory.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
          <Button type="button" size="sm" onClick={() => { setEditing(null); setCreating(true); }}>
            Add offering
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No offerings yet. Add menus, bar packages, services, or rental products.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {visible.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{o.name}</p>
                  {o.categoryName && <Badge variant="muted">{o.categoryName}</Badge>}
                  {o.isArchived && <Badge variant="outline">Archived</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatOptionalMoney(o.defaultUnitPrice)}
                  {o.unit ? ` / ${o.unit}` : ""}
                  {o.description ? ` · ${o.description}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setCreating(false); setEditing(o); }}>
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const result = await setOfferingArchivedAction(o.id, !o.isArchived);
                    if (!result.ok) toast.error(result.message ?? "Could not update.");
                    else {
                      setOfferings((prev) => prev.map((x) => x.id === o.id ? { ...x, isArchived: !o.isArchived } : x));
                      toast.success(o.isArchived ? "Restored." : "Archived.");
                    }
                  }}
                >
                  {o.isArchived ? "Restore" : "Archive"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <OfferingFormSheet
        open={creating || !!editing}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}
        offering={editing}
        categories={cats}
        inventoryItems={inventoryItems}
        onCategoryCreated={(c) => setCats((prev) => [...prev, c])}
        onSaved={(o) => {
          setOfferings((prev) => {
            const idx = prev.findIndex((x) => x.id === o.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = o;
              return next;
            }
            return [...prev, o];
          });
          setCreating(false);
          setEditing(null);
        }}
      />

      <p className="text-xs text-muted-foreground">
        Physical stock and floor-plan items live in{" "}
        <Link href="/library/inventory" className="text-primary underline">Inventory</Link>.
      </p>
    </div>
  );
}

function OfferingFormSheet({
  open, onOpenChange, offering, categories, inventoryItems, onSaved, onCategoryCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  offering: OfferingWithCategory | null;
  categories: OfferingCategory[];
  inventoryItems: InventoryItem[];
  onSaved: (o: OfferingWithCategory) => void;
  onCategoryCreated: (c: OfferingCategory) => void;
}) {
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [defaultUnitPrice, setDefaultUnitPrice] = React.useState("");
  const [inventoryItemId, setInventoryItemId] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setName(offering?.name ?? "");
    setCategoryId(offering?.categoryId ?? "");
    setDescription(offering?.description ?? "");
    setUnit(offering?.unit ?? "");
    setDefaultUnitPrice(offering?.defaultUnitPrice != null ? String(offering.defaultUnitPrice) : "");
    setInventoryItemId(offering?.inventoryItemId ?? "");
    setNewCategory("");
  }, [open, offering]);

  function input(): OfferingInput {
    return {
      name,
      categoryId: categoryId || null,
      description,
      unit,
      defaultUnitPrice,
      inventoryItemId: inventoryItemId || null,
    };
  }

  function handleSave() {
    startTransition(async () => {
      if (offering) {
        const result = await updateOfferingAction(offering.id, input());
        if (!result.ok) { toast.error(result.message ?? "Could not save."); return; }
        const catName = categories.find((c) => c.id === (categoryId || null))?.name ?? null;
        onSaved({
          ...offering,
          ...input(),
          categoryId: categoryId || null,
          description: description.trim() || null,
          unit: unit.trim() || null,
          defaultUnitPrice: defaultUnitPrice.trim() === "" ? null : Number(defaultUnitPrice.replace(/[$,]/g, "")),
          inventoryItemId: inventoryItemId || null,
          categoryName: catName,
        });
        toast.success("Offering updated.");
      } else {
        const result = await createOfferingAction(input());
        if (!result.ok) { toast.error(result.message ?? "Could not create."); return; }
        const catName = categories.find((c) => c.id === (categoryId || null))?.name ?? null;
        onSaved({
          id: result.offeringId,
          venueId: "",
          categoryId: categoryId || null,
          name: name.trim(),
          description: description.trim() || null,
          unit: unit.trim() || null,
          defaultUnitPrice: defaultUnitPrice.trim() === "" ? null : Number(defaultUnitPrice.replace(/[$,]/g, "")),
          inventoryItemId: inventoryItemId || null,
          isArchived: false,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          categoryName: catName,
        });
        toast.success("Offering created.");
      }
    });
  }

  function handleAddCategory() {
    startTransition(async () => {
      const result = await createOfferingCategoryAction(newCategory);
      if (!result.ok) { toast.error(result.message ?? "Could not add category."); return; }
      const created = {
        id: result.categoryId, venueId: "", name: newCategory.trim(), sortOrder: 0,
        createdAt: "", updatedAt: "",
      };
      onCategoryCreated(created);
      setCategoryId(created.id);
      setNewCategory("");
      toast.success("Category added.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{offering ? "Edit offering" : "Add offering"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <Input placeholder="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="h-9 text-sm" />
              <Button type="button" variant="outline" size="sm" disabled={!newCategory.trim() || pending} onClick={handleAddCategory}>Add</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="guest, each…" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Default price (optional)</Label>
              <Input value={defaultUnitPrice} onChange={(e) => setDefaultUnitPrice(e.target.value)} placeholder="—" className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Link to Inventory (optional — rentals)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={inventoryItemId}
              onChange={(e) => setInventoryItemId(e.target.value)}
            >
              <option value="">None</option>
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>{i.printableName || i.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!name.trim() || pending} onClick={handleSave}>
            {offering ? "Save" : "Create"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
