"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  defaultApplySelections,
  formatTemplateOfferingPrice,
  linesForSection,
  unsectionedLines,
  type TemplateApplySelection,
} from "@/lib/event-order-templates/offerings";
import type { EventOrderTemplateLine, EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

export function TemplateApplyChooser({
  template,
  selections,
  onChange,
}: {
  template: EventOrderTemplateWithDetails;
  selections: TemplateApplySelection[];
  onChange: (next: TemplateApplySelection[]) => void;
}) {
  const sections = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const loose = unsectionedLines(template.lines);

  function toggle(lineId: string, selected: boolean) {
    onChange(selections.map((s) => (s.lineId === lineId ? { ...s, selected } : s)));
  }

  function setQty(lineId: string, quantity: number) {
    onChange(selections.map((s) => (s.lineId === lineId ? { ...s, quantity } : s)));
  }

  function offeringRow(line: EventOrderTemplateLine) {
    const sel = selections.find((s) => s.lineId === line.id);
    return (
      <li key={line.id} className="rounded-md border border-border p-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={Boolean(sel?.selected)}
            onChange={(e) => toggle(line.id, e.target.checked)}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-heading">{line.description}</span>
            <span className="block text-xs text-muted-foreground">
              {formatTemplateOfferingPrice(line)}
            </span>
          </span>
        </label>
        {sel?.selected ? (
          <div className="mt-2 pl-7">
            <label className="text-xs text-muted-foreground">
              Quantity
              <Input
                className="mt-1 h-8"
                inputMode="numeric"
                value={String(sel.quantity)}
                onChange={(e) => setQty(line.id, Number(e.target.value) || 1)}
              />
            </label>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const offerings = linesForSection(template.lines, section.id);
        return (
          <div key={section.id} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-heading">{section.name}</p>
            {section.guidance ? (
              <p className="text-xs text-muted-foreground">{section.guidance}</p>
            ) : null}
            {offerings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Section only — no offerings to select.</p>
            ) : (
              <ul className="space-y-2">{offerings.map(offeringRow)}</ul>
            )}
          </div>
        );
      })}
      {loose.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-heading">Other offerings</p>
          <ul className="space-y-2">{loose.map(offeringRow)}</ul>
        </div>
      ) : null}
      {template.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This template is sections only. Applying it adds those categories to the Event Order.
        </p>
      ) : null}
    </div>
  );
}

export function ApplyEventOrderTemplateSheet({
  open,
  onOpenChange,
  template,
  pending,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EventOrderTemplateWithDetails | null;
  pending: boolean;
  onApply: (selections: TemplateApplySelection[]) => Promise<void>;
}) {
  const [selections, setSelections] = React.useState<TemplateApplySelection[]>([]);

  React.useEffect(() => {
    if (open && template) setSelections(defaultApplySelections(template.lines));
  }, [open, template]);

  if (!template) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader className="mb-4">
          <SheetTitle>Apply {template.name}</SheetTitle>
        </SheetHeader>
        <p className="mb-4 text-sm text-muted-foreground">
          Choose what this event should receive. Applying creates event-specific structure — not an invoice, contract, or payment.
        </p>
        <div className="min-h-0 flex-1">
          <TemplateApplyChooser template={template} selections={selections} onChange={setSelections} />
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => void onApply(selections)}
          >
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Apply to event
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
