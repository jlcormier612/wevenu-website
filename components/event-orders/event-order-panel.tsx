"use client";

import * as React from "react";

import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addSectionAction, ensureEventOrderAction, finalizeEventOrderAction,
  removeLineAction, removeSectionAction, reopenEventOrderAction, setSectionFloorPlanAction,
} from "@/app/(app)/events/[id]/event-order-actions";
import { AddLineSheet } from "@/components/event-orders/add-line-sheet";
import { EventOrderInvoiceLink } from "@/components/event-orders/event-order-invoice-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DISPLAY_STATUS_LABEL, PROVENANCE_LABEL, eventOrderDisplayStatus, formatMoney } from "@/lib/event-orders/constants";
import type { EventOrderDisplayStatus, EventOrderLine, EventOrderSection, EventOrderWithDetails } from "@/lib/event-orders/types";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { InventoryItem } from "@/lib/inventory/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Package } from "@/lib/packages/types";

const STATUS_VARIANT: Record<EventOrderDisplayStatus, "outline" | "accent" | "muted"> = {
  open: "outline", finalized: "accent", amended: "muted",
};

function LineRow({ line, onRemove, removing }: { line: EventOrderLine; onRemove: () => void; removing: boolean }) {
  return (
    <div className="group grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center py-2 border-b border-border last:border-0 text-sm">
      <div className="min-w-0">
        <span className="text-foreground">{line.description}</span>
        <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">{PROVENANCE_LABEL[line.provenance]}</span>
      </div>
      <span className="text-muted-foreground text-right w-14">{line.quantity}×</span>
      <span className="text-muted-foreground text-right w-20">{formatMoney(line.unitPrice)}</span>
      <span className="font-medium text-right w-20">{formatMoney(line.amount)}</span>
      <button type="button" onClick={onRemove} disabled={removing}
        className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity" aria-label="Remove">
        {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function AddSectionInline({ eventOrderId, eventId, disabled }: { eventOrderId: string; eventId: string; disabled: boolean }) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleAdd() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await addSectionAction(eventOrderId, eventId, name);
      if (result.ok) { setAdding(false); setName(""); }
      else toast.error(result.message ?? "Could not add section.");
    });
  }

  if (!adding) {
    return (
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setAdding(true)}>
        + Add Section
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ceremony, Reception, Bar…" className="h-9 w-56 text-sm" autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }} />
      <Button type="button" size="sm" disabled={!name.trim() || pending} onClick={handleAdd}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setName(""); }} disabled={pending}>Cancel</Button>
    </div>
  );
}

/**
 * Phase 4 — which Floor Plan (if any) this Section reconciles against.
 * Purely an Event Order authoring choice: Event Order owns which Floor Plan
 * a Section corresponds to; this never creates, edits, or reads placement
 * data on the Floor Plan itself. Hidden entirely when the event has no
 * Floor Plans at all, so a booking that doesn't use Floor Plans sees
 * nothing new here.
 */
function SectionFloorPlanLink({
  eventOrderId, eventId, section, floorPlans, disabled,
}: {
  eventOrderId: string; eventId: string; section: EventOrderSection; floorPlans: FloorPlan[]; disabled: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  if (floorPlans.length === 0) return null;

  const options = [
    { value: "none", label: "No floor plan linked" },
    ...floorPlans.map((p) => ({ value: p.id, label: p.name })),
  ];

  function handleChange(value: string) {
    startTransition(async () => {
      const result = await setSectionFloorPlanAction(eventOrderId, eventId, section.id, value === "none" ? null : value);
      if (!result.ok) toast.error(result.message ?? "Could not link floor plan.");
    });
  }

  return (
    <Select value={section.floorPlanId ?? "none"} onValueChange={handleChange} items={options} disabled={disabled || pending}>
      <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground hover:text-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EventOrderPanel({
  eventId, clientId, eventOrder, packages, inventoryItems, invoices, floorPlans,
}: {
  eventId: string;
  clientId: string | null;
  eventOrder: EventOrderWithDetails | null;
  packages: Package[];
  inventoryItems: InventoryItem[];
  invoices: Invoice[];
  floorPlans: FloorPlan[];
}) {
  const [starting, startStarting] = React.useTransition();
  const [lifecyclePending, startLifecycle] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [removingSectionId, setRemovingSectionId] = React.useState<string | null>(null);

  if (!eventOrder) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Order</CardTitle>
          <CardDescription>The single record of what this event will actually receive.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">No Event Order yet.</p>
            <Button type="button" size="sm" disabled={starting}
              onClick={() => startStarting(async () => {
                const result = await ensureEventOrderAction(eventId);
                if (!result.ok) toast.error(result.message ?? "Could not start Event Order.");
              })}>
              {starting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Starting…</> : "Start Event Order"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Narrowed to a stable, non-null binding — the closures below are only
  // ever invoked from JSX rendered after this point, but TS can't follow
  // that through a mutable outer-scope prop on its own.
  const order = eventOrder;
  const displayStatus = eventOrderDisplayStatus(order);
  const isFinalized = order.status === "finalized";
  const unsectioned = order.lines.filter((l) => !l.sectionId);

  async function handleRemoveLine(line: EventOrderLine) {
    setRemovingId(line.id);
    const result = await removeLineAction(order.id, eventId, line.id, line.description);
    setRemovingId(null);
    if (!result.ok) toast.error(result.message ?? "Could not remove line.");
  }

  async function handleRemoveSection(sectionId: string, name: string) {
    if (!confirm(`Remove "${name}"? Its lines will stay, unsectioned.`)) return;
    setRemovingSectionId(sectionId);
    const result = await removeSectionAction(order.id, eventId, sectionId, name);
    setRemovingSectionId(null);
    if (!result.ok) toast.error(result.message ?? "Could not remove section.");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Event Order</CardTitle>
              <Badge variant={STATUS_VARIANT[displayStatus]}>
                {DISPLAY_STATUS_LABEL[displayStatus]}{eventOrder.revision > 0 ? ` · v${eventOrder.revision}` : ""}
              </Badge>
            </div>
            <CardDescription>The single record of what this event will actually receive.</CardDescription>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <p className="text-sm text-muted-foreground">
              Running total: <span className="font-semibold text-heading">{formatMoney(eventOrder.total)}</span>
            </p>
            {isFinalized ? (
              <Button type="button" variant="outline" size="sm" disabled={lifecyclePending}
                onClick={() => startLifecycle(async () => {
                  const result = await reopenEventOrderAction(eventOrder.id, eventId);
                  if (!result.ok) toast.error(result.message ?? "Could not reopen.");
                })}>
                {lifecyclePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reopen"}
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={lifecyclePending || (eventOrder.lines.length === 0)}
                onClick={() => startLifecycle(async () => {
                  const result = await finalizeEventOrderAction(eventOrder.id, eventId);
                  if (!result.ok) toast.error(result.message ?? "Could not finalize.");
                  else toast.success("Event Order finalized.");
                })}>
                {lifecyclePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Finalize"}
              </Button>
            )}
          </div>
        </div>
        {clientId && (
          <div className="pt-3 mt-3 border-t border-border/60">
            <EventOrderInvoiceLink eventOrderId={eventOrder.id} eventId={eventId} clientId={clientId} invoices={invoices} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {eventOrder.sections.map((section) => {
          const lines = eventOrder.lines.filter((l) => l.sectionId === section.id);
          return (
            <div key={section.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold text-heading">{section.name}</p>
                  <SectionFloorPlanLink eventOrderId={eventOrder.id} eventId={eventId} section={section} floorPlans={floorPlans} disabled={isFinalized} />
                </div>
                <div className="flex items-center gap-2">
                  {!isFinalized && <AddLineSheet eventOrderId={eventOrder.id} eventId={eventId} sectionId={section.id} packages={packages} inventoryItems={inventoryItems} onAdded={() => {}} />}
                  {!isFinalized && (
                    <button type="button" onClick={() => handleRemoveSection(section.id, section.name)} disabled={removingSectionId === section.id}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Remove section">
                      {removingSectionId === section.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              {lines.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No lines in this section yet.</p>
              ) : (
                <div>
                  {lines.map((line) => (
                    <LineRow key={line.id} line={line} removing={removingId === line.id} onRemove={() => handleRemoveLine(line)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="space-y-2">
          {eventOrder.sections.length > 0 && <p className="text-sm font-semibold text-heading">General</p>}
          {unsectioned.length === 0 ? (
            eventOrder.sections.length > 0 && <p className="text-xs text-muted-foreground py-2">Nothing unsectioned.</p>
          ) : (
            <div>
              {unsectioned.map((line) => (
                <LineRow key={line.id} line={line} removing={removingId === line.id} onRemove={() => handleRemoveLine(line)} />
              ))}
            </div>
          )}
          {eventOrder.lines.length === 0 && eventOrder.sections.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Nothing added yet. Add a line, or organize with sections first.</p>
          )}
        </div>

        {!isFinalized && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
            <AddSectionInline eventOrderId={eventOrder.id} eventId={eventId} disabled={lifecyclePending} />
            <AddLineSheet eventOrderId={eventOrder.id} eventId={eventId} sectionId={null} packages={packages} inventoryItems={inventoryItems} onAdded={() => {}} />
          </div>
        )}

        {eventOrder.activities.length > 0 && (
          <details className="pt-2 border-t border-border/60">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Activity ({eventOrder.activities.length})</summary>
            <div className="mt-2 space-y-1.5">
              {eventOrder.activities.map((a) => (
                <p key={a.id} className="text-xs text-muted-foreground">
                  <span className="text-foreground">{a.title}</span>{a.description ? ` — ${a.description}` : ""}
                </p>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
