"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addInventoryTemplateItemAction, deleteInventoryTemplateAction, removeInventoryTemplateItemAction,
} from "@/app/(app)/events/[id]/event-inventory-actions";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventoryItemInput, InventoryTemplateWithItems } from "@/lib/event-inventory/types";
import type { InventoryItem } from "@/lib/inventory/types";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function AddTemplateItemInline({ templateId, catalogItems }: { templateId: string; catalogItems: InventoryItem[] }) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [isIncluded, setIsIncluded] = React.useState(true);
  const [pending, startTransition] = React.useTransition();

  function reset() { setName(""); setCategory(""); setQuantity("1"); setUnitPrice(""); setIsIncluded(true); setAdding(false); }

  function handleAdd() {
    if (!name.trim()) return;
    const input: InventoryItemInput = { name, category, quantity, unitPrice, isIncluded };
    startTransition(async () => {
      const result = await addInventoryTemplateItemAction(templateId, input);
      if (result.ok) reset();
      else toast.error(result.message ?? "Could not add item.");
    });
  }

  if (!adding) {
    return <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>+ Add Item</Button>;
  }

  return (
    <div className="rounded-sm border border-border p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" autoFocus />
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" />
        <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Price each (optional)" />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="tmpl-included" checked={isIncluded} onCheckedChange={(v) => setIsIncluded(v === true)} />
        <Label htmlFor="tmpl-included" className="text-sm font-normal cursor-pointer">Included in the base package</Label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!name.trim() || pending} onClick={handleAdd}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
        </Button>
      </div>
    </div>
  );
}

export function InventoryTemplateDetail({ template, catalogItems }: { template: InventoryTemplateWithItems; catalogItems: InventoryItem[] }) {
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const router = useRouter();

  async function handleRemove(itemId: string, name: string) {
    if (!confirm(`Remove "${name}"?`)) return;
    setRemovingId(itemId);
    const result = await removeInventoryTemplateItemAction(template.id, itemId);
    setRemovingId(null);
    if (!result.ok) toast.error(result.message ?? "Could not remove item.");
  }

  function handleDelete() {
    if (!confirm(`Delete "${template.name}"? This can't be undone. Events already created from it are unaffected.`)) return;
    startDelete(async () => {
      const result = await deleteInventoryTemplateAction(template.id);
      if (result.ok) { toast.success("Template deleted."); router.push("/library/inventory-templates"); }
      else toast.error(result.message ?? "Could not delete.");
    });
  }

  return (
    <div className="space-y-6">
      <BusinessAssetHeader
        backHref="/library/inventory-templates"
        backLabel="Inventory Templates"
        whatIsThis="Inventory Template"
        title={template.name}
        status={template.isArchived ? <Badge variant="muted">Archived</Badge> : <Badge variant="outline">Active</Badge>}
        lastUpdated={new Date(template.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      />
      {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <p className="text-sm font-medium text-heading">Items ({template.items.length})</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {template.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No items yet.</p>
          ) : (
            <div>
              {template.items.map((item) => (
                <div key={item.id} className="group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
                  <div className="min-w-0">
                    <span className="text-foreground">{item.name}</span>
                    {item.category && <span className="ml-2 text-xs text-muted-foreground">{item.category}</span>}
                  </div>
                  <span className="text-muted-foreground text-right w-12">×{item.quantity}</span>
                  <span className="text-right w-24 font-medium text-foreground">{item.unitPrice != null ? formatMoney(item.unitPrice) : "—"}</span>
                  <Badge variant={item.isIncluded ? "outline" : "accent"} className="w-fit justify-self-end">{item.isIncluded ? "Included" : "Additional"}</Badge>
                  <button type="button" onClick={() => handleRemove(item.id, item.name)} disabled={removingId === item.id}
                    className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity justify-self-end">
                    {removingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
          <AddTemplateItemInline templateId={template.id} catalogItems={catalogItems} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={deleting} onClick={handleDelete}>
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete Template"}
        </Button>
      </div>
    </div>
  );
}
