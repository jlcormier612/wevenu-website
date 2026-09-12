"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import {
  addCustomLineAction, addLineFromInventoryAction, addLineFromOfferingAction,
  addLineFromPackageAction, importPackageInclusionsAction,
} from "@/app/(app)/events/[id]/event-order-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, formatOptionalMoney } from "@/lib/event-orders/constants";
import type { EventOrderLine } from "@/lib/event-orders/types";
import type { InventoryItem } from "@/lib/inventory/types";
import type { Offering } from "@/lib/offerings/types";
import type { Package, PackageWithItems } from "@/lib/packages/types";

type Source = "offering" | "inventory" | "custom" | "package-inclusions" | "package-fee";

/**
 * Primary path: select from Offerings.
 * Secondary: Inventory (physical), Custom exception, Package inclusions import,
 * advanced package fee.
 */
export function AddLineSheet({
  eventOrderId, eventId, sectionId, offerings, packages, packagesWithItems,
  inventoryItems, onAdded,
}: {
  eventOrderId: string; eventId: string; sectionId: string | null;
  offerings: Offering[];
  packages: Package[];
  packagesWithItems: PackageWithItems[];
  inventoryItems: InventoryItem[];
  onAdded: (line: EventOrderLine) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<Source | null>(null);
  const [query, setQuery] = React.useState("");
  const [offeringId, setOfferingId] = React.useState("");
  const [inventoryItemId, setInventoryItemId] = React.useState("");
  const [packageId, setPackageId] = React.useState("");
  const [selectedInclusionIndexes, setSelectedInclusionIndexes] = React.useState<Set<number>>(new Set());
  const [description, setDescription] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [unit, setUnit] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [isIncluded, setIsIncluded] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function reset() {
    setSource(null); setQuery(""); setOfferingId(""); setInventoryItemId("");
    setPackageId(""); setSelectedInclusionIndexes(new Set());
    setDescription(""); setQuantity("1"); setUnit(""); setUnitPrice("");
    setIsIncluded(true); setNotes(""); setError("");
  }

  function pickOffering(id: string) {
    const o = offerings.find((x) => x.id === id);
    setOfferingId(id);
    setDescription(o?.name ?? "");
    setUnit(o?.unit ?? "");
    setUnitPrice(o?.defaultUnitPrice != null ? String(o.defaultUnitPrice) : "");
  }

  function pickInventory(id: string) {
    const item = inventoryItems.find((i) => i.id === id);
    setInventoryItemId(id);
    setDescription(item?.printableName || item?.name || "");
  }

  const filteredOfferings = offerings.filter((o) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return o.name.toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q);
  });

  const pkgWithItems = packagesWithItems.find((p) => p.id === packageId);

  function handleAdd() {
    startTransition(async () => {
      if (source === "offering") {
        const o = offerings.find((x) => x.id === offeringId);
        if (!o) { setError("Choose an offering."); return; }
        const result = await addLineFromOfferingAction(eventOrderId, eventId, {
          offeringId: o.id,
          description,
          quantity,
          unitPrice,
          sectionId,
          unit,
          isIncluded,
          notes,
          descriptionDetail: o.description ?? undefined,
          inventoryItemId: o.inventoryItemId,
        });
        if (result.ok) { onAdded(result.line); toast.success("Added to Event Order."); setOpen(false); reset(); }
        else { setError(result.message ?? "Could not add."); toast.error(result.message ?? "Could not add."); }
        return;
      }
      if (source === "inventory") {
        const result = await addLineFromInventoryAction(eventOrderId, eventId, {
          inventoryItemId, description, quantity, unitPrice, sectionId, unit, isIncluded, notes,
        });
        if (result.ok) { onAdded(result.line); toast.success("Added to Event Order."); setOpen(false); reset(); }
        else { setError(result.message ?? "Could not add."); toast.error(result.message ?? "Could not add."); }
        return;
      }
      if (source === "custom") {
        const result = await addCustomLineAction(eventOrderId, eventId, {
          description, quantity, unitPrice, sectionId, unit, isIncluded, notes,
        });
        if (result.ok) { onAdded(result.line); toast.success("Added to Event Order."); setOpen(false); reset(); }
        else { setError(result.message ?? "Could not add."); toast.error(result.message ?? "Could not add."); }
        return;
      }
      if (source === "package-inclusions") {
        if (!pkgWithItems) { setError("Choose a package."); return; }
        const items = pkgWithItems.items
          .filter((_, i) => selectedInclusionIndexes.has(i))
          .map((it) => ({ description: it.description, quantity: it.quantity, unit: it.unit }));
        const result = await importPackageInclusionsAction(eventOrderId, eventId, items, sectionId);
        if (result.ok) {
          toast.success(`Imported ${result.addedCount ?? items.length} inclusion${(result.addedCount ?? items.length) === 1 ? "" : "s"}.`);
          setOpen(false); reset();
          onAdded({} as EventOrderLine);
        } else {
          setError(result.message ?? "Could not import."); toast.error(result.message ?? "Could not import.");
        }
        return;
      }
      if (source === "package-fee") {
        const pkg = packages.find((p) => p.id === packageId);
        if (!pkg) { setError("Choose a package."); return; }
        if (pkg.basePrice == null) {
          setError("Set a price on this package in Packages first.");
          return;
        }
        const result = await addLineFromPackageAction(eventOrderId, eventId, pkg.id, pkg.name, pkg.basePrice, sectionId);
        if (result.ok) { onAdded(result.line); toast.success("Package fee line added."); setOpen(false); reset(); }
        else { setError(result.message ?? "Could not add."); toast.error(result.message ?? "Could not add."); }
      }
    });
  }

  const canSubmit =
    (source === "offering" && !!offeringId && description.trim() && quantity.trim()) ||
    (source === "inventory" && !!inventoryItemId && description.trim() && quantity.trim()) ||
    (source === "custom" && description.trim() && quantity.trim()) ||
    (source === "package-inclusions" && !!packageId && selectedInclusionIndexes.size > 0) ||
    (source === "package-fee" && !!packageId);

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
        + Add item
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Add to Event Order</SheetTitle>
          <p className="text-sm text-muted-foreground">What is this event receiving?</p>
        </SheetHeader>

        <div className="space-y-3">
          <SourceCard
            active={source === "offering"}
            title="From Offerings"
            subtitle="Menus, bar, services, and rentals you provide."
            onClick={() => setSource("offering")}
          >
            {source === "offering" && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <Input placeholder="Search offerings…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 text-sm" />
                {filteredOfferings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No offerings yet.{" "}
                    <Link href="/library/offerings" className="text-primary underline">Add Offerings in Library</Link>
                  </p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {filteredOfferings.map((o) => (
                      <button key={o.id} type="button" onClick={() => pickOffering(o.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${offeringId === o.id ? "border-primary bg-primary/10 font-medium" : "border-border hover:border-primary/40"}`}>
                        <span>{o.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatOptionalMoney(o.defaultUnitPrice)}{o.unit ? ` / ${o.unit}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {offeringId && (
                  <ConfigureFields
                    description={description} setDescription={setDescription}
                    quantity={quantity} setQuantity={setQuantity}
                    unit={unit} setUnit={setUnit}
                    unitPrice={unitPrice} setUnitPrice={setUnitPrice}
                    isIncluded={isIncluded} setIsIncluded={setIsIncluded}
                    notes={notes} setNotes={setNotes}
                  />
                )}
              </div>
            )}
          </SourceCard>

          <SourceCard
            active={source === "inventory"}
            title="From Inventory"
            subtitle="Physical stock (chairs, tables, linens…)."
            onClick={() => setSource("inventory")}
          >
            {source === "inventory" && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {inventoryItems.map((item) => (
                    <button key={item.id} type="button" onClick={() => pickInventory(item.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${inventoryItemId === item.id ? "border-primary bg-primary/10 font-medium" : "border-border hover:border-primary/40"}`}>
                      {item.printableName || item.name}
                    </button>
                  ))}
                </div>
                {inventoryItemId && (
                  <ConfigureFields
                    description={description} setDescription={setDescription}
                    quantity={quantity} setQuantity={setQuantity}
                    unit={unit} setUnit={setUnit}
                    unitPrice={unitPrice} setUnitPrice={setUnitPrice}
                    isIncluded={isIncluded} setIsIncluded={setIsIncluded}
                    notes={notes} setNotes={setNotes}
                  />
                )}
              </div>
            )}
          </SourceCard>

          {packagesWithItems.length > 0 && (
            <SourceCard
              active={source === "package-inclusions"}
              title="Import package inclusions"
              subtitle="Copies package descriptions as Included lines (not Offerings)."
              onClick={() => setSource("package-inclusions")}
            >
              {source === "package-inclusions" && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {packagesWithItems.filter((p) => p.isActive).map((p) => (
                    <button key={p.id} type="button" onClick={() => { setPackageId(p.id); setSelectedInclusionIndexes(new Set(p.items.map((_, i) => i))); }}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${packageId === p.id ? "border-primary bg-primary/10 font-medium" : "border-border hover:border-primary/40"}`}>
                      {p.name}
                    </button>
                  ))}
                  {pkgWithItems && (
                    <div className="space-y-1 pt-2">
                      <p className="text-xs text-muted-foreground">Select inclusions to import:</p>
                      {pkgWithItems.items.map((it, i) => (
                        <label key={i} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedInclusionIndexes.has(i)}
                            onChange={() => {
                              setSelectedInclusionIndexes((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i); else next.add(i);
                                return next;
                              });
                            }}
                            className="mt-1"
                          />
                          <span>{it.description}{it.quantity ? ` · ${it.quantity}` : ""}{it.unit ? ` ${it.unit}` : ""}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </SourceCard>
          )}

          <SourceCard
            active={source === "custom"}
            title="Custom item"
            subtitle="Exception — type a one-off line."
            onClick={() => setSource("custom")}
          >
            {source === "custom" && (
              <div className="mt-3 border-t border-border pt-3">
                <ConfigureFields
                  description={description} setDescription={setDescription}
                  quantity={quantity} setQuantity={setQuantity}
                  unit={unit} setUnit={setUnit}
                  unitPrice={unitPrice} setUnitPrice={setUnitPrice}
                  isIncluded={isIncluded} setIsIncluded={setIsIncluded}
                  notes={notes} setNotes={setNotes}
                />
              </div>
            )}
          </SourceCard>

          {packages.length > 0 && (
            <details className="rounded-xl border border-border p-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Advanced: add package fee as one line</summary>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">Prefer importing inclusions or selecting Offerings. This adds the package base price as a single informational line.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setSource("package-fee")}>Show packages</Button>
                {source === "package-fee" && (
                  <div className="space-y-1.5">
                    {packages.filter((p) => p.isActive).map((p) => (
                      <button key={p.id} type="button" onClick={() => setPackageId(p.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${packageId === p.id ? "border-primary bg-primary/10 font-medium" : "border-border"}`}>
                        {p.name} — {p.basePrice == null ? "Set your price" : formatMoney(p.basePrice)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!canSubmit || pending} onClick={handleAdd}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SourceCard({
  active, title, subtitle, onClick, children,
}: {
  active: boolean; title: string; subtitle: string; onClick: () => void; children?: React.ReactNode;
}) {
  return (
    <div className={`w-full rounded-xl border text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-border"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-xl p-4 text-left transition-colors ${active ? "" : "hover:bg-muted/40"}`}
      >
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </button>
      {children ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function ConfigureFields({
  description, setDescription, quantity, setQuantity, unit, setUnit,
  unitPrice, setUnitPrice, isIncluded, setIsIncluded, notes, setNotes,
}: {
  description: string; setDescription: (v: string) => void;
  quantity: string; setQuantity: (v: string) => void;
  unit: string; setUnit: (v: string) => void;
  unitPrice: string; setUnitPrice: (v: string) => void;
  isIncluded: boolean; setIsIncluded: (v: boolean) => void;
  notes: string; setNotes: (v: string) => void;
}) {
  return (
    <div className="space-y-3 pt-2">
      <div>
        <Label className="text-xs">Name</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 text-sm" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Qty</Label>
          <Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Unit</Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="each" className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Price (optional)</Label>
          <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="—" className="h-9 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={isIncluded ? "default" : "outline"} onClick={() => setIsIncluded(true)}>Included</Button>
        <Button type="button" size="sm" variant={!isIncluded ? "default" : "outline"} onClick={() => setIsIncluded(false)}>Additional</Button>
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" />
      </div>
    </div>
  );
}
