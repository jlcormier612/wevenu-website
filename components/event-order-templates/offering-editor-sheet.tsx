"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATE_PRICING_MODEL_LABELS,
  inferPricingModelFromUnit,
  type TemplatePricingModel,
} from "@/lib/event-order-templates/offerings";
import { CategorizedOfferingSelect } from "@/components/event-order-templates/categorized-offering-select";
import type { AddTemplateLineInput, EventOrderTemplateLine } from "@/lib/event-order-templates/types";
import type { OfferingWithCategory } from "@/lib/offerings/types";

const PRICED_MODELS: TemplatePricingModel[] = ["flat", "per_person", "per_unit", "custom"];

export function OfferingEditorSheet({
  open,
  onOpenChange,
  sectionId,
  sectionName = null,
  line,
  defaultIncluded = false,
  catalogOfferings,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string | null;
  sectionName?: string | null;
  line: EventOrderTemplateLine | null;
  /** Starting "covered by the package price" value for a new line. */
  defaultIncluded?: boolean;
  catalogOfferings: OfferingWithCategory[];
  pending: boolean;
  onSave: (input: AddTemplateLineInput) => Promise<boolean>;
}) {
  const available = catalogOfferings.filter((o) => !o.isArchived);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [hasPrice, setHasPrice] = React.useState(false);
  const [unitPrice, setUnitPrice] = React.useState("");
  const [pricingModel, setPricingModel] = React.useState<TemplatePricingModel>("flat");
  const [unit, setUnit] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [included, setIncluded] = React.useState(false);
  const [offeringId, setOfferingId] = React.useState<string | null>(null);
  /** Explicit custom path when adding (secondary to catalog select). */
  const [customMode, setCustomMode] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    if (line) {
      setName(line.description);
      setDescription(line.descriptionDetail ?? "");
      const priced = line.pricingModel !== "none";
      setHasPrice(priced);
      setUnitPrice(line.unitPrice != null ? String(line.unitPrice) : "");
      setPricingModel(priced ? line.pricingModel : "flat");
      setUnit(line.unit ?? "");
      setQuantity(String(line.quantity || 1));
      setIncluded(line.includedByDefault);
      setOfferingId(line.offeringId);
      setCustomMode(!line.offeringId);
    } else {
      setName("");
      setDescription("");
      setHasPrice(false);
      setUnitPrice("");
      setPricingModel("flat");
      setUnit("");
      setQuantity("1");
      setIncluded(defaultIncluded);
      setOfferingId(null);
      setCustomMode(available.length === 0);
    }
    setError("");
  }, [open, line, available.length, defaultIncluded]);

  function applyCatalog(id: string) {
    const offering = available.find((o) => o.id === id);
    if (!offering) {
      setOfferingId(null);
      return;
    }
    setCustomMode(false);
    setOfferingId(offering.id);
    setName(offering.name);
    setDescription(offering.description ?? "");
    if (offering.defaultUnitPrice != null) {
      setHasPrice(true);
      setUnitPrice(String(offering.defaultUnitPrice));
      setPricingModel(inferPricingModelFromUnit(offering.unit));
    } else {
      setHasPrice(false);
      setUnitPrice("");
      setPricingModel("flat");
    }
    setUnit(offering.unit ?? "");
  }

  function startCustom() {
    setCustomMode(true);
    setOfferingId(null);
    setName("");
    setDescription("");
    setHasPrice(false);
    setUnitPrice("");
    setPricingModel("flat");
    setUnit("");
    setQuantity("1");
    setIncluded(defaultIncluded);
  }

  const showFields = Boolean(line) || Boolean(offeringId) || customMode;

  async function handleSave() {
    if (!name.trim()) {
      setError("Give this offering a name.");
      return;
    }
    const ok = await onSave({
      description: name,
      descriptionDetail: description,
      quantity,
      unitPrice,
      hasPrice,
      pricingModel: hasPrice ? pricingModel : "none",
      unit,
      includedByDefault: included,
      offeringId,
      sectionId: line?.sectionId ?? sectionId,
    });
    if (ok) onOpenChange(false);
    else setError("Could not save this offering.");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>{line ? "Edit package item" : "Add package item"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          {!line && available.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-heading">Select from Offerings</Label>
              <CategorizedOfferingSelect
                offerings={available}
                sectionName={sectionName}
                value={offeringId ?? ""}
                onChange={(id) => {
                  if (id) applyCatalog(id);
                }}
                testId="eo-line-offering-picker"
                disabled={pending}
              />
              <div className="space-y-1.5 text-xs text-muted-foreground" data-testid="eo-line-source-help">
                <p>
                  <span className="font-medium text-heading">From Offerings</span> — reuse a catalog
                  product or service across event orders. Details copy into this template as a snapshot.
                </p>
                <p>
                  <span className="font-medium text-heading">Template-only</span> — for a one-off line on
                  this package. Inventory is managed separately and is not selected here.
                </p>
              </div>
              {!customMode ? (
                <button
                  type="button"
                  className="text-xs font-medium text-heading underline-offset-2 hover:underline"
                  onClick={startCustom}
                >
                  Or add a custom / template-only line
                </button>
              ) : null}
            </div>
          ) : null}

          {line?.offeringId ? (
            <p className="rounded-sm border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              From Offerings catalog — edits apply to this template only.
            </p>
          ) : null}
          {line && !line.offeringId ? (
            <p className="text-xs text-muted-foreground">Custom offering on this template.</p>
          ) : null}
          {!line && available.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No Offerings yet — write a custom line below, or add catalog items in Offerings first.
            </p>
          ) : null}
          {!line && customMode && available.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Add an item or service directly to this event order when you don&apos;t need it in your
              reusable Offerings list. This is not a reusable catalog Offering.{" "}
              <button type="button" className="font-medium text-heading underline-offset-2 hover:underline" onClick={() => { setCustomMode(false); setName(""); }}>
                Select from catalog instead
              </button>
            </p>
          ) : null}

          {showFields ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="offering-name" className="text-sm font-medium text-heading">Offering name</Label>
                <Input
                  id="offering-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus={Boolean(line) || customMode || available.length === 0}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offering-description" className="text-sm font-medium text-heading">Description</Label>
                <Textarea
                  id="offering-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Optional"
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={hasPrice}
                  onChange={(e) => setHasPrice(e.target.checked)}
                  className="mt-1 size-4 shrink-0"
                />
                <span>
                  This offering has a price
                  <span className="block text-xs text-muted-foreground">Leave unchecked for operational guidance with no price.</span>
                </span>
              </label>

              {hasPrice ? (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-heading">Pricing</Label>
                    <Select value={pricingModel} onValueChange={(v) => setPricingModel(v as TemplatePricingModel)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRICED_MODELS.map((m) => (
                          <SelectItem key={m} value={m}>{TEMPLATE_PRICING_MODEL_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {pricingModel !== "custom" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="offering-price" className="text-sm font-medium text-heading">Price</Label>
                      <Input
                        id="offering-price"
                        inputMode="decimal"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Custom / TBD — no price required.</p>
                  )}
                  {(pricingModel === "per_unit" || pricingModel === "per_person") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="offering-unit" className="text-sm font-medium text-heading">Unit</Label>
                      <Input
                        id="offering-unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder={pricingModel === "per_person" ? "person" : "chair, table, hour…"}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="offering-qty" className="text-sm font-medium text-heading">Default quantity</Label>
                <Input id="offering-qty" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>

              <label className="flex items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={(e) => setIncluded(e.target.checked)}
                  className="mt-1 size-4 shrink-0"
                  data-testid="eo-line-covered-by-package"
                />
                <span>
                  Covered by the package price
                  <span className="block text-xs text-muted-foreground">
                    Uncheck if this item is an additional charge. The item still belongs on the package
                    without a couple choice either way.
                  </span>
                </span>
              </label>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                <Button type="button" onClick={() => void handleSave()} disabled={pending || !name.trim()}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : line ? "Save package item" : "Add package item"}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
