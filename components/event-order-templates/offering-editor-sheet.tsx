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
import type { AddTemplateLineInput, EventOrderTemplateLine } from "@/lib/event-order-templates/types";
import type { Offering } from "@/lib/offerings/types";

const PRICED_MODELS: TemplatePricingModel[] = ["flat", "per_person", "per_unit", "custom"];

export function OfferingEditorSheet({
  open,
  onOpenChange,
  sectionId,
  line,
  catalogOfferings,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string | null;
  line: EventOrderTemplateLine | null;
  catalogOfferings: Offering[];
  pending: boolean;
  onSave: (input: AddTemplateLineInput) => Promise<boolean>;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [hasPrice, setHasPrice] = React.useState(false);
  const [unitPrice, setUnitPrice] = React.useState("");
  const [pricingModel, setPricingModel] = React.useState<TemplatePricingModel>("flat");
  const [unit, setUnit] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [included, setIncluded] = React.useState(false);
  const [offeringId, setOfferingId] = React.useState<string | null>(null);
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
    } else {
      setName("");
      setDescription("");
      setHasPrice(false);
      setUnitPrice("");
      setPricingModel("flat");
      setUnit("");
      setQuantity("1");
      setIncluded(false);
      setOfferingId(null);
    }
    setError("");
  }, [open, line]);

  function applyCatalog(id: string) {
    const offering = catalogOfferings.find((o) => o.id === id);
    if (!offering) {
      setOfferingId(null);
      return;
    }
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
          <SheetTitle>{line ? "Edit offering" : "Add offering"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          {catalogOfferings.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-heading">From your offerings</Label>
              <Select
                value={offeringId ?? "custom"}
                onValueChange={(v) => {
                  if (v === "custom") setOfferingId(null);
                  else applyCatalog(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Start from a Library offering (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Write a new offering</SelectItem>
                  {catalogOfferings.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optional. Choosing one copies its details into this template — it does not stay linked for live prices.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="offering-name" className="text-sm font-medium text-heading">Offering name</Label>
            <Input id="offering-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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
            />
            <span>
              Included by default
              <span className="block text-xs text-muted-foreground">Selected when this template is applied to an event.</span>
            </span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="button" onClick={() => void handleSave()} disabled={pending || !name.trim()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : line ? "Save offering" : "Add offering"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
