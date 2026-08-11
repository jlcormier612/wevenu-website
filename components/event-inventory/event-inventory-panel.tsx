"use client";

import * as React from "react";

import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEventInventoryToEventOrderAction, ensureEventInventoryAction, finalizeEventInventoryAction,
  removeEventInventoryItemAction, reopenEventInventoryAction, shareEventInventoryAction,
} from "@/app/(app)/events/[id]/event-inventory-actions";
import { ItemSheet } from "@/components/event-inventory/item-sheet";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { EventInventoryItem, EventInventoryStatus, EventInventoryWithDetails, InventoryTemplate } from "@/lib/event-inventory/types";
import type { InventoryItem } from "@/lib/inventory/types";

const STATUS_LABEL: Record<EventInventoryStatus, string> = { draft: "Draft", shared: "Shared with client", finalized: "Finalized" };
const STATUS_VARIANT: Record<EventInventoryStatus, BadgeVariant> = { draft: "muted", shared: "default", finalized: "success" };

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function ItemRow({ item, eventInventoryId, eventId, catalogItems, editable, onRemove, removing }: {
  item: EventInventoryItem; eventInventoryId: string; eventId: string; catalogItems: InventoryItem[];
  editable: boolean; onRemove: () => void; removing: boolean;
}) {
  return (
    <div className="group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 py-2.5 border-b border-border last:border-0 text-sm">
      <div className="min-w-0">
        <span className="text-foreground">{item.name}</span>
        {item.category && <span className="ml-2 text-xs text-muted-foreground">{item.category}</span>}
        {item.notes && <p className="mt-0.5 text-xs text-muted-foreground truncate">{item.notes}</p>}
        {item.addedToEventOrderAt && <p className="mt-0.5 text-xs text-success">✓ In the Event Order</p>}
      </div>
      <span className="text-muted-foreground text-right w-12">×{item.quantity}</span>
      <span className="text-right w-24 font-medium text-foreground">
        {item.unitPrice != null ? formatMoney(item.unitPrice) : <span className="font-normal text-muted-foreground">—</span>}
      </span>
      <Badge variant={item.isIncluded ? "outline" : "accent"} className="w-fit justify-self-end">
        {item.isIncluded ? "Included" : "Additional"}
      </Badge>
      {editable ? (
        <div className="flex items-center gap-0.5 justify-self-end">
          <ItemSheet eventInventoryId={eventInventoryId} eventId={eventId} catalogItems={catalogItems} existingItem={item} />
          <button type="button" onClick={onRemove} disabled={removing}
            className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity" aria-label="Remove">
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : <span />}
    </div>
  );
}

function StartInventory({ eventId, templates }: { eventId: string; templates: InventoryTemplate[] }) {
  const [templateId, setTemplateId] = React.useState<string>("blank");
  const [starting, startTransition] = React.useTransition();

  const options = [{ value: "blank", label: "Start blank" }, ...templates.map((t) => ({ value: t.id, label: t.name }))];

  function handleStart() {
    startTransition(async () => {
      const result = await ensureEventInventoryAction(eventId, templateId === "blank" ? null : templateId);
      if (!result.ok) toast.error(result.message ?? "Could not start Event Inventory.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Event Inventory</CardTitle>
        <CardDescription>What's actually part of this event — chairs, decor, bar service, anything selected for this booking.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          {templates.length > 0 && (
            <Select value={templateId} onValueChange={setTemplateId} items={options}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button type="button" size="sm" disabled={starting} onClick={handleStart}>
            {starting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Starting…</> : "Start Event Inventory"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EventInventoryPanel({
  eventId, eventInventory, templates, catalogItems,
}: {
  eventId: string;
  eventInventory: EventInventoryWithDetails | null;
  templates: InventoryTemplate[];
  catalogItems: InventoryItem[];
}) {
  const [lifecyclePending, startLifecycle] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  if (!eventInventory) return <StartInventory eventId={eventId} templates={templates} />;

  const inv = eventInventory;
  const isFinalized = inv.status === "finalized";
  const isDraft = inv.status === "draft";
  const billableTotal = inv.items.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0);
  // D8 — per-item, not a permanent all-time flag: reflects exactly what's
  // still eligible right now, so items added after a prior push (Reopen →
  // add more → Finalize again) correctly bring this button back.
  const hasUnpushedBillable = inv.items.some((i) => i.unitPrice != null && i.unitPrice > 0 && !i.addedToEventOrderAt);

  async function handleRemove(item: EventInventoryItem) {
    if (!confirm(`Remove "${item.name}"?`)) return;
    setRemovingId(item.id);
    const result = await removeEventInventoryItemAction(inv.id, eventId, item.id, item.name);
    setRemovingId(null);
    if (!result.ok) toast.error(result.message ?? "Could not remove item.");
  }

  return (
    <Card>
      <CardHeader>
        <BusinessAssetHeader
          compact
          whatIsThis="Event Inventory"
          title="Event Inventory"
          status={<Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>}
          lastUpdated={new Date(inv.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          primaryAction={isFinalized ? (
            <div className="flex items-center gap-2">
              {hasUnpushedBillable && (
                <Button type="button" variant="outline" size="sm" disabled={lifecyclePending}
                  onClick={() => startLifecycle(async () => {
                    const result = await addEventInventoryToEventOrderAction(inv.id, eventId);
                    if (result.ok) toast.success(`Added ${result.addedCount} item${result.addedCount === 1 ? "" : "s"} (${formatMoney(result.addedTotal)}) to the Event Order.`);
                    else toast.error(result.message ?? "Could not add to Event Order.");
                  })}>
                  Add to Event Order
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" disabled={lifecyclePending}
                onClick={() => startLifecycle(async () => {
                  const result = await reopenEventInventoryAction(inv.id, eventId);
                  if (!result.ok) toast.error(result.message ?? "Could not reopen.");
                })}>
                {lifecyclePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reopen"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isDraft && (
                <Button type="button" variant="outline" size="sm" disabled={lifecyclePending}
                  onClick={() => startLifecycle(async () => {
                    const result = await shareEventInventoryAction(inv.id, eventId);
                    if (result.ok) toast.success("Shared with client.");
                    else toast.error(result.message ?? "Could not share.");
                  })}>
                  Share with client
                </Button>
              )}
              <Button type="button" size="sm" disabled={lifecyclePending || inv.items.length === 0}
                onClick={() => startLifecycle(async () => {
                  const result = await finalizeEventInventoryAction(inv.id, eventId);
                  if (result.ok) toast.success("Event Inventory finalized.");
                  else toast.error(result.message ?? "Could not finalize.");
                })}>
                {lifecyclePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Finalize"}
              </Button>
            </div>
          )}
        />
        <p className="text-xs text-muted-foreground -mt-1">
          What's actually part of this event. Additional-cost total: <span className="font-medium text-foreground">{formatMoney(billableTotal)}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {inv.items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nothing added yet.</p>
        ) : (
          <div>
            {inv.items.map((item) => (
              <ItemRow key={item.id} item={item} eventInventoryId={inv.id} eventId={eventId} catalogItems={catalogItems}
                editable={!isFinalized} onRemove={() => handleRemove(item)} removing={removingId === item.id} />
            ))}
          </div>
        )}

        {!isFinalized && (
          <div className="flex items-center justify-end pt-2 border-t border-border/60">
            <ItemSheet eventInventoryId={inv.id} eventId={eventId} catalogItems={catalogItems} />
          </div>
        )}

        {inv.activities.length > 0 && (
          <details className="pt-2 border-t border-border/60">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Activity ({inv.activities.length})</summary>
            <div className="mt-2">
              <ActivityTimeline activities={inv.activities} />
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
