"use client";

import * as React from "react";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import {
  createOfferingAction,
  createOfferingCategoryAction,
  setOfferingArchivedAction,
  updateOfferingAction,
  updateOfferingImageAction,
} from "@/app/(app)/library/offerings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { effectiveOfferingImageUrl, offeringImageBasePath } from "@/lib/catalog-images/types";
import {
  removeCatalogImage,
  uploadCatalogImage,
} from "@/lib/catalog-images/upload-client";
import { validateCatalogImageFile } from "@/lib/catalog-images/validate";
import { formatOptionalMoney } from "@/lib/event-orders/constants";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  formatParentOfferingNames,
  hasParents,
  majorOfferingIds,
  offeringRole,
  offeringRoleLabel,
  orderOfferingsHierarchically,
  parentIdsOf,
  topLevelOfferings,
} from "@/lib/offerings/hierarchy";
import type { OfferingCategory, OfferingInput, OfferingWithCategory } from "@/lib/offerings/types";

export const OfferingsLibrarySection = React.forwardRef<
  { openCreate: () => void },
  {
    venueId: string;
    initialOfferings: OfferingWithCategory[];
    categories: OfferingCategory[];
    inventoryItems: InventoryItem[];
    /** When false, PageHeader owns + New Offering. */
    headerCreate?: boolean;
  }
>(function OfferingsLibrarySection({
  venueId, initialOfferings, categories, inventoryItems, headerCreate = true,
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
  const placements = orderOfferingsHierarchically(visible);
  const majors = majorOfferingIds(offerings);
  const nameById = new Map(offerings.map((o) => [o.id, o.name]));

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

      {placements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No offerings yet. Add a service category, then major choices and the items that belong under them.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="offerings-list">
          {placements.map(({ offering: o, nestUnderParentId }) => {
            const role = offeringRole(o, majors);
            const isChild = hasParents(o);
            const nestLabel = nestUnderParentId
              ? nameById.get(nestUnderParentId) ?? null
              : null;
            const underLabel = nestLabel
              ? nestLabel
              : o.parentOfferingName ?? null;
            return (
              <li
                key={`${o.id}::${nestUnderParentId ?? "top"}`}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${isChild && nestUnderParentId ? "bg-muted/20 pl-8" : ""}`}
                data-testid={`offering-row-${o.id}`}
                data-nest-under={nestUnderParentId ?? ""}
                data-offering-role={role}
                data-parent-ids={parentIdsOf(o).join(",")}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {(() => {
                    const thumb = effectiveOfferingImageUrl({
                      imageUrl: o.imageUrl,
                      inventoryImageUrl: o.inventoryImageUrl,
                    });
                    if (!thumb) return null;
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-md border border-border/60 bg-muted/30 object-contain"
                        data-testid={`offering-thumb-${o.id}`}
                      />
                    );
                  })()}
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{o.name}</p>
                    {o.categoryName && <Badge variant="muted">{o.categoryName}</Badge>}
                    <Badge variant="outline">{offeringRoleLabel(role)}</Badge>
                    {o.isArchived && <Badge variant="outline">Archived</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isChild && underLabel
                      ? `Under ${underLabel} · `
                      : ""}
                    {formatOptionalMoney(o.defaultUnitPrice)}
                    {o.unit ? ` / ${o.unit}` : ""}
                    {o.description ? ` · ${o.description}` : ""}
                  </p>
                  </div>
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
        venueId={venueId}
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
  open, onOpenChange, venueId, offering, defaultParentId, offerings, categories, inventoryItems, onSaved, onCategoryCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  venueId: string;
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
  const [parentOfferingIds, setParentOfferingIds] = React.useState<string[]>([]);
  const [description, setDescription] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [defaultUnitPrice, setDefaultUnitPrice] = React.useState("");
  const [inventoryItemId, setInventoryItemId] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [newCategory, setNewCategory] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const majorsWithChildren = majorOfferingIds(offerings);
  const editingIsMajorWithChildren = Boolean(offering && majorsWithChildren.has(offering.id));
  const parentCandidates = topLevelOfferings(offerings).filter((o) => o.id !== offering?.id);

  React.useEffect(() => {
    if (!open) return;
    setName(offering?.name ?? "");
    const existingParents = offering
      ? parentIdsOf(offering)
      : defaultParentId
        ? [defaultParentId]
        : [];
    setParentOfferingIds(existingParents);
    const firstParent = offerings.find((o) => o.id === existingParents[0]);
    setCategoryId(offering?.categoryId ?? firstParent?.categoryId ?? "");
    setDescription(offering?.description ?? "");
    setUnit(offering?.unit ?? "");
    setDefaultUnitPrice(offering?.defaultUnitPrice != null ? String(offering.defaultUnitPrice) : "");
    setInventoryItemId(offering?.inventoryItemId ?? "");
    setImageUrl(offering?.imageUrl ?? null);
    setFile(null);
    setNewCategory("");
  }, [open, offering, defaultParentId, offerings]);

  function toggleParent(id: string) {
    setParentOfferingIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!prev.includes(id)) {
        const parent = offerings.find((o) => o.id === id);
        if (parent?.categoryId) setCategoryId(parent.categoryId);
      }
      return next;
    });
  }

  function input(): OfferingInput {
    return {
      name,
      categoryId: categoryId || null,
      parentOfferingIds: editingIsMajorWithChildren ? [] : parentOfferingIds,
      description,
      unit,
      defaultUnitPrice,
      inventoryItemId: inventoryItemId || null,
    };
  }

  function buildSaved(partial: {
    id: string;
    venueId: string;
    isArchived: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }): OfferingWithCategory {
    const catName = categories.find((c) => c.id === (categoryId || null))?.name ?? null;
    const parentNames = parentOfferingIds
      .map((id) => offerings.find((o) => o.id === id)?.name)
      .filter((n): n is string => Boolean(n))
      .sort((a, b) => a.localeCompare(b));
    const primary = parentOfferingIds[0] ?? null;
    return {
      ...partial,
      name: name.trim(),
      categoryId: categoryId || null,
      parentOfferingIds: [...parentOfferingIds],
      parentOfferingId: primary,
      description: description.trim() || null,
      unit: unit.trim() || null,
      defaultUnitPrice: defaultUnitPrice.trim() === "" ? null : Number(defaultUnitPrice.replace(/[$,]/g, "")),
      inventoryItemId: inventoryItemId || null,
      imageUrl,
      inventoryImageUrl: inventoryItemId
        ? inventoryItems.find((i) => i.id === inventoryItemId)?.imageUrl ?? null
        : null,
      categoryName: catName,
      parentOfferingNames: parentNames,
      parentOfferingName: formatParentOfferingNames(parentNames),
    };
  }

  async function persistImage(offeringId: string): Promise<string | null> {
    if (!file) return imageUrl;
    const validated = validateCatalogImageFile(file);
    if (!validated.ok) {
      toast.error(validated.message);
      return imageUrl;
    }
    if (!venueId) {
      toast.error("Could not determine venue for photo upload.");
      return imageUrl;
    }
    try {
      const url = await uploadCatalogImage({
        basePath: offeringImageBasePath(venueId, offeringId),
        file,
      });
      const result = await updateOfferingImageAction(offeringId, url);
      if (!result.ok) throw new Error(result.message ?? "Could not save photo.");
      setImageUrl(url);
      setFile(null);
      return url;
    } catch {
      toast.error("Offering saved, but the photo upload failed — try again from Edit.");
      return imageUrl;
    }
  }

  async function clearImage() {
    if (!offering?.id || !venueId) return;
    startTransition(async () => {
      try {
        await removeCatalogImage(offeringImageBasePath(venueId, offering.id));
        const result = await updateOfferingImageAction(offering.id, null);
        if (!result.ok) throw new Error(result.message ?? "Could not remove photo.");
        setImageUrl(null);
        setFile(null);
        onSaved({
          ...buildSaved({
            id: offering.id,
            venueId: offering.venueId || venueId,
            isArchived: offering.isArchived,
            sortOrder: offering.sortOrder,
            createdAt: offering.createdAt,
            updatedAt: new Date().toISOString(),
          }),
          imageUrl: null,
        });
        toast.success("Photo removed.");
      } catch {
        toast.error("Could not remove the photo.");
      }
    });
  }

  function handleSave() {
    startTransition(async () => {
      if (offering) {
        const result = await updateOfferingAction(offering.id, input());
        if (!result.ok) { toast.error(result.message ?? "Could not save."); return; }
        const nextImage = await persistImage(offering.id);
        onSaved({
          ...buildSaved({
            id: offering.id,
            venueId: offering.venueId || venueId,
            isArchived: offering.isArchived,
            sortOrder: offering.sortOrder,
            createdAt: offering.createdAt,
            updatedAt: new Date().toISOString(),
          }),
          imageUrl: nextImage,
        });
        toast.success("Offering updated.");
      } else {
        const result = await createOfferingAction(input());
        if (!result.ok) { toast.error(result.message ?? "Could not create."); return; }
        const nextImage = await persistImage(result.offeringId);
        onSaved({
          ...buildSaved({
            id: result.offeringId,
            venueId,
            isArchived: false,
            sortOrder: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          imageUrl: nextImage,
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

  const hasAnyParent = parentOfferingIds.length > 0;

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
          <SheetTitle>
            {offering
              ? "Edit offering"
              : hasAnyParent
                ? "Add item under major choice"
                : "Add offering"}
          </SheetTitle>
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
            <Label className="text-xs">Belongs under major choices (optional)</Label>
            {editingIsMajorWithChildren ? (
              <p className="mt-1 text-[0.7rem] text-muted-foreground" data-testid="offering-parent-locked">
                This offering is already a major choice with items under it, so it stays top-level.
              </p>
            ) : (
              <>
                <div
                  className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2"
                  data-testid="offering-parents"
                  role="group"
                  aria-label="Major choices this offering belongs under"
                >
                  {parentCandidates.length === 0 ? (
                    <p className="px-1 py-1 text-xs text-muted-foreground">
                      No top-level major choices yet. Leave unchecked for a standalone or major choice.
                    </p>
                  ) : (
                    parentCandidates.map((p) => {
                      const checked = parentOfferingIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40"
                          data-testid={`offering-parent-${p.id}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => toggleParent(p.id)}
                            data-testid={`offering-parent-check-${p.id}`}
                          />
                          <span>
                            {p.name}
                            {p.categoryName ? (
                              <span className="text-muted-foreground"> · {p.categoryName}</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  Select one or more major service choices (for example Plated Dinner and Buffet Dinner)
                  so the same catalog item can appear under each. Leave none selected for a major choice
                  or standalone offering. Removing a check removes only that association.
                </p>
              </>
            )}
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
          <div className="space-y-1.5">
            <Label className="text-xs">
              Photo <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            {imageUrl && !file ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-20 w-20 rounded-lg border border-border bg-muted/40 object-contain"
                data-testid="offering-photo-preview"
              />
            ) : null}
            {!imageUrl && !file && inventoryItemId ? (() => {
              const fallback = inventoryItems.find((i) => i.id === inventoryItemId)?.imageUrl;
              if (!fallback) return null;
              return (
                <p className="text-[0.7rem] text-muted-foreground">
                  No dedicated photo yet — couples will see the linked Inventory photo until you upload one.
                </p>
              );
            })() : null}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              data-testid="offering-photo-input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
            />
            {offering?.imageUrl ? (
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => void clearImage()}>
                Remove photo
              </Button>
            ) : null}
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
