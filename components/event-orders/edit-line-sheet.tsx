"use client";

import * as React from "react";

import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { updateLineAction } from "@/app/(app)/events/[id]/event-order-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { EventOrderLine, EventOrderSection } from "@/lib/event-orders/types";

export function EditLineSheet({
  eventOrderId, eventId, line, sections, onUpdated,
}: {
  eventOrderId: string;
  eventId: string;
  line: EventOrderLine;
  sections: EventOrderSection[];
  onUpdated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState(line.description);
  const [quantity, setQuantity] = React.useState(String(line.quantity));
  const [unit, setUnit] = React.useState(line.unit ?? "");
  const [unitPrice, setUnitPrice] = React.useState(line.unitPrice == null ? "" : String(line.unitPrice));
  const [isIncluded, setIsIncluded] = React.useState(line.isIncluded);
  const [notes, setNotes] = React.useState(line.notes ?? "");
  const [sectionId, setSectionId] = React.useState(line.sectionId ?? "");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setDescription(line.description);
      setQuantity(String(line.quantity));
      setUnit(line.unit ?? "");
      setUnitPrice(line.unitPrice == null ? "" : String(line.unitPrice));
      setIsIncluded(line.isIncluded);
      setNotes(line.notes ?? "");
      setSectionId(line.sectionId ?? "");
    }
  }, [open, line]);

  function handleSave() {
    startTransition(async () => {
      const result = await updateLineAction(eventOrderId, eventId, line.id, {
        description,
        quantity,
        unitPrice,
        unit,
        isIncluded,
        notes,
        sectionId: sectionId || null,
      });
      if (result.ok) {
        toast.success("Line updated.");
        setOpen(false);
        onUpdated?.();
      } else {
        toast.error(result.message ?? "Could not update.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Edit line" />}>
        <Pencil className="h-3.5 w-3.5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Edit item</SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
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
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="h-9 text-sm" />
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
          {sections.length > 0 && (
            <div>
              <Label className="text-xs">Section</Label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                <option value="">General</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!description.trim() || pending} onClick={handleSave}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
