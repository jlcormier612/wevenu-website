"use client";

/**
 * Shared create/edit form for an Inventory item (Inventory Foundation task).
 * Categories are venue-created (Requirement 3) — no fixed list, quick-added
 * inline via a prompt, same lightweight pattern the rest of this codebase
 * uses for one-field renames (see floor-plan-templates-section.tsx).
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createCategoryAction, createItemAction, updateItemAction, updateItemImageAction } from "@/app/(app)/library/inventory/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/integrations/supabase/client";
import { DISPLAY_SHAPES, DISPLAY_SHAPE_LABELS } from "@/components/floor-plan/floor-plan-shapes";
import type { InventoryCategory, InventoryItem, InventoryShape } from "@/lib/inventory/types";

const NO_CATEGORY = "__none__";
const NO_SHAPE = "__none__";

// Every shape the Floor Plan canvas knows how to draw (Floor Plan Editor
// Completion — Phase 2's shape library), so an item created here can always
// be given a shape that actually renders as itself on a Floor Plan instead
// of falling back to a plain rectangle.
const SHAPE_OPTIONS: { value: InventoryShape; label: string }[] = DISPLAY_SHAPES.map((value) => ({
  value, label: DISPLAY_SHAPE_LABELS[value],
}));

export function InventoryItemForm({
  item, categories: initialCategories, venueId,
}: { item?: InventoryItem; categories: InventoryCategory[]; venueId: string }) {
  const router = useRouter();
  const [categories, setCategories] = React.useState(initialCategories);
  const [name, setName] = React.useState(item?.name ?? "");
  const [categoryId, setCategoryId] = React.useState(item?.categoryId ?? NO_CATEGORY);
  const [quantityAvailable, setQuantityAvailable] = React.useState(item ? String(item.quantityAvailable) : "0");
  const [width, setWidth] = React.useState(item?.width != null ? String(item.width) : "");
  const [length, setLength] = React.useState(item?.length != null ? String(item.length) : "");
  const [height, setHeight] = React.useState(item?.height != null ? String(item.height) : "");
  const [shape, setShape] = React.useState<string>(item?.shape ?? NO_SHAPE);
  const [color, setColor] = React.useState(item?.color ?? "");
  const [printableName, setPrintableName] = React.useState(item?.printableName ?? "");
  const [availableForFloorPlans, setAvailableForFloorPlans] = React.useState(item?.availableForFloorPlans ?? false);
  const [file, setFile] = React.useState<File | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleAddCategory() {
    const proposed = window.prompt("New category name");
    if (!proposed || !proposed.trim()) return;
    const result = await createCategoryAction(proposed.trim());
    if (result.ok) {
      const created = { id: result.categoryId, venueId, name: proposed.trim(), sortOrder: categories.length, createdAt: "", updatedAt: "" };
      setCategories((prev) => [...prev, created]);
      setCategoryId(created.id);
    } else {
      toast.error(result.message ?? "Could not add category.");
    }
  }

  async function uploadImage(itemId: string) {
    if (!file) return;
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${venueId}/${itemId}/image.${ext}`;
      const { error: uploadError } = await supabase.storage.from("inventory").upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("inventory").getPublicUrl(path);
      await updateItemImageAction(itemId, publicUrl);
    } catch {
      toast.error("Item saved, but the photo upload failed — you can try again from this page.");
    }
  }

  function handleSubmit() {
    if (!name.trim()) return;
    setPending(true);
    void (async () => {
      const input = {
        name: name.trim(),
        categoryId: categoryId === NO_CATEGORY ? null : categoryId,
        quantityAvailable: parseInt(quantityAvailable, 10) || 0,
        width: width.trim() ? parseFloat(width) : null,
        length: length.trim() ? parseFloat(length) : null,
        height: height.trim() ? parseFloat(height) : null,
        shape: shape === NO_SHAPE ? null : (shape as InventoryShape),
        color: color.trim() || null,
        printableName: printableName.trim() || null,
        availableForFloorPlans,
      };

      let itemId: string;
      if (item) {
        const result = await updateItemAction(item.id, input);
        if (!result.ok) { toast.error(result.message ?? "Could not save item."); setPending(false); return; }
        itemId = item.id;
      } else {
        const result = await createItemAction(input);
        if (!result.ok) { toast.error(result.message ?? "Could not save item."); setPending(false); return; }
        itemId = result.itemId;
      }
      await uploadImage(itemId);
      toast.success(item ? "Item updated." : "Item created.");
      router.push("/library/inventory");
      router.refresh();
    })();
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chiavari Chair — Gold" className="h-9 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Category <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <div className="flex items-center gap-2">
          <Select value={categoryId} onValueChange={setCategoryId} items={[{ value: NO_CATEGORY, label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}>
            <SelectTrigger className="h-9 flex-1 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>No category</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={handleAddCategory}>+ New Category</Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Quantity Available</Label>
        <Input type="number" value={quantityAvailable} onChange={(e) => setQuantityAvailable(e.target.value)} className="h-9 w-32 text-sm" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Width (in) <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Length (in) <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="number" value={length} onChange={(e) => setLength(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Height (in) <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Width and Length set this item&apos;s footprint on the Floor Plan canvas (in inches) — e.g. a 60&quot; round table is Width 60, Length 60.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Shape <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Select value={shape} onValueChange={setShape} items={[{ value: NO_SHAPE, label: "Not set" }, ...SHAPE_OPTIONS]}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SHAPE}>Not set</SelectItem>
              {SHAPE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Color <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Gold" className="h-9 text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Printable Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input value={printableName} onChange={(e) => setPrintableName(e.target.value)} placeholder="Shown on Floor Plans and printouts instead of Name" className="h-9 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Photo <span className="font-normal text-muted-foreground">(optional)</span></Label>
        {item?.imageUrl && !file && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />
        )}
        <input
          type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={availableForFloorPlans} onCheckedChange={setAvailableForFloorPlans} />
        <Label className="text-xs cursor-pointer">Available for use in Floor Plans</Label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.push("/library/inventory")} disabled={pending}>Cancel</Button>
        <Button type="button" disabled={!name.trim() || pending} onClick={handleSubmit}>
          {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : item ? "Save Changes" : "Create Item"}
        </Button>
      </div>
    </div>
  );
}
