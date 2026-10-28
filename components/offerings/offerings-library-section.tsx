"use client";

import * as React from "react";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import {
  majorOfferingIds,
  offeringRole,
  offeringRoleLabel,
  orderOfferingsHierarchically,
  topLevelOfferings,
} from "@/lib/offerings/hierarchy";
import type { OfferingCategory, OfferingInput, OfferingWithCategory } from "@/lib/offerings/types";

export const OfferingsLibrarySection = React.forwardRef<
  { openCreate: () => void },
  {
    initialOfferings: OfferingWithCategory[];
    categories: OfferingCategory[];
    inventoryItems: InventoryItem[];
    /** When false, PageHeader owns + New Offering. */
    headerCreate?: boolean;
  }
>(function OfferingsLibrarySection({
  initialOfferings, categories, inventoryItems, headerCreate = true,
}, ref) {
  const [offerings, setOfferings] = React.useState(initialOfferings);
  const [cats, setCats] = React.useState(categories);
  const [editing, setEditing] = React.useState<OfferingWithCategory | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [createParentId, setCreateParentId] = React.useState<string | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);

  React.useImperativeHandle(ref, () => ({
    openCreate: () => { setEditing(null); setCreateParentId(null); setCreating(true); },
  }));

  const visible = offerings.filter((o) => showArchived || !o.isArchived);
  const ordered = orderOfferingsHierarchically(visible);
  const majors = majorOfferingIds(offerings);

  return (
    <div className="space-y-4" data-testid="offerings-library">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
        {headerCreate ? (
          <Button
            type="button"
            size="sm"
            data-testid="offerings-new"
            onClick={() => { setEditing(null); setCreateParentId(null); setCreating(true); }}
          >
            + New Offering
          </Button>
        ) : null}
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No offerings yet. Add a service category, then major choices and the items that belong under them.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="offerings-list">
          {ordered.map((o) => {
            const role = offeringRole(o, majors);
            const isChild = Boolean(o.parentOfferingId);
            return (
              <li
                key={o.id}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${isChild ? "bg-muted/20 pl-8" : ""}`}
                data-testid={`offering-row-${o.id}`}
                data-offering-role={role}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{o.name}</p>
                    {o.categoryName && <Badge variant="muted">{o.categoryName}</Badge>}
                    <Badge variant="outline">{offeringRoleLabel(role)}</Badge>
                    {o.isArchived && <Badge variant="outline">Archived</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isChild && o.parentOfferingName
                      ? `Under ${o.parentOfferingName} · `
                      : ""}
                    {formatOptionalMoney(o.defaultUnitPrice)}
                    {o.unit ? ` / ${o.unit}` : ""}
                    {o.description ? ` · ${o.description}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role !== "item" && !o.isArchived ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`offering-add-item-${o.id}`}
                      onClick={() => {
                        setEditing(null);
                        setCreateParentId(o.id);
                        setCreating(true);
                      }}
                    >
                      + Item under this
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => { setCreating(false); setCreateParentId(null); setEditing(o); }}>
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
            );
          })}
        </ul>
      )}

      <OfferingFormSheet
        open={creating || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
            setCreateParentId(null);
          }
        }}
        offering={editing}
        defaultParentId={createParentId}
        offerings={offerings}
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
          setCreateParentId(null);
        }}
      />

      <p className="text-xs text-muted-foreground">
        Physical stock and floor-plan items live in{" "}
        <Link href="/library/inventory" className="text-primary underline">Inventory</Link>.
        Linking an offering to inventory does not reserve stock.
      </p>
    </div>
  );
});

function OfferingFormSheet({
  open, onOpenChange, offering, defaultParentId, offerings, categories, inventoryItems, onSaved, onCategoryCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  offering: OfferingWithCategory | null;
  defaultParentId: string | null;
  offerings: OfferingWithCategory[];
  categories: OfferingCategory[];
  inventoryItems: InventoryItem[];
  onSaved: (o: OfferingWithCategory) => void;
  onCategoryCreated: (c: OfferingCategory) => void;
}) {
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [parentOfferingId, setParentOfferingId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [defaultUnitPrice, setDefaultUnitPrice] = React.useState("");
  const [inventoryItemId, setInventoryItemId] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const parentCandidates = topLevelOfferings(offerings).filter((o) => o.id !== offering?.id);

  React.useEffect(() => {
    if (!open) return;
    setName(offering?.name ?? "");
    const parentId = offering?.parentOfferingId ?? defaultParentId ?? "";
    setParentOfferingId(parentId);
    const parent = offerings.find((o) => o.id === parentId);
    setCategoryId(offering?.categoryId ?? parent?.categoryId ?? "");
    setDescription(offering?.description ?? "");
    setUnit(offering?.unit ?? "");
    setDefaultUnitPrice(offering?.defaultUnitPrice != null ? String(offering.defaultUnitPrice) : "");
    setInventoryItemId(offering?.inventoryItemId ?? "");
    setNewCategory("");
  }, [open, offering, defaultParentId, offerings]);

  function input(): OfferingInput {
    return {
      name,
      categoryId: categoryId || null,
      parentOfferingId: parentOfferingId || null,
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
        const parentName = parentOfferingId
          ? offerings.find((o) => o.id === parentOfferingId)?.name ?? null
          : null;
        onSaved({
          ...offering,
          ...input(),
          categoryId: categoryId || null,
          parentOfferingId: parentOfferingId || null,
          description: description.trim() || null,
          unit: unit.trim() || null,
          defaultUnitPrice: defaultUnitPrice.trim() === "" ? null : Number(defaultUnitPrice.replace(/[$,]/g, "")),
          inventoryItemId: inventoryItemId || null,
          categoryName: catName,
          parentOfferingName: parentName,
        });
        toast.success("Offering updated.");
      } else {
        const result = await createOfferingAction(input());
        if (!result.ok) { toast.error(result.message ?? "Could not create."); return; }
        const catName = categories.find((c) => c.id === (categoryId || null))?.name ?? null;
        const parentName = parentOfferingId
          ? offerings.find((o) => o.id === parentOfferingId)?.name ?? null
          : null;
        onSaved({
          id: result.offeringId,
          venueId: "",
          categoryId: categoryId || null,
          parentOfferingId: parentOfferingId || null,
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
          parentOfferingName: parentName,
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
        <SheetHeader className="mb-6 space-y-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Offerings
          </Button>
          <SheetTitle>{offering ? "Edit offering" : parentOfferingId ? "Add item under major choice" : "Add offering"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" data-testid="offering-name" />
          </div>
          <div>
            <Label className="text-xs">Service category</Label>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              data-testid="offering-category"
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
            <Label className="text-xs">Belongs under major choice (optional)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={parentOfferingId}
              onChange={(e) => {
                const next = e.target.value;
                setParentOfferingId(next);
                const parent = offerings.find((o) => o.id === next);
                if (parent?.categoryId) setCategoryId(parent.categoryId);
              }}
              data-testid="offering-parent"
            >
              <option value="">None — top-level major choice or standalone</option>
              {parentCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.categoryName ? ` · ${p.categoryName}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              Leave empty for a major service choice couples pick first. Nest menu or package items
              under that choice so Event Order Templates can offer them as follow-up selections.
            </p>
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
          <Button type="button" disabled={!name.trim() || pending} onClick={handleSave} data-testid="offering-save">
            {offering ? "Save" : "Create"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
