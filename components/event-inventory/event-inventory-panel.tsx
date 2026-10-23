"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEventInventoryToEventOrderAction, confirmInventorySelectionsAction, ensureEventInventoryAction,
  finalizeEventInventoryAction, removeEventInventoryItemAction, reopenEventInventoryAction,
  requestInventorySelectionChangesAction, setInventoryItemClientSelectableAction, shareEventInventoryAction,
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
import { eventInventoryListPriceLabel } from "@/lib/event-inventory/list-display";
import type { EventInventoryItem, EventInventoryStatus, EventInventoryWithDetails, InventoryTemplate } from "@/lib/event-inventory/types";
import type { InventoryItem } from "@/lib/inventory/types";

const STATUS_LABEL: Record<EventInventoryStatus, string> = {
  draft: "Draft",
  shared: "Shared with client",
  submitted: "Client submitted",
  changes_requested: "Changes requested",
  confirmed: "Confirmed",
  finalized: "Finalized",
};
const STATUS_VARIANT: Record<EventInventoryStatus, BadgeVariant> = {
  draft: "muted",
  shared: "default",
  submitted: "accent",
  changes_requested: "default",
  confirmed: "success",
  finalized: "success",
};

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function ItemRow({ item, eventInventoryId, eventId, catalogItems, editable, onRemove, removing, onToggleSelectable }: {
  item: EventInventoryItem; eventInventoryId: string; eventId: string; catalogItems: InventoryItem[];
  editable: boolean; onRemove: () => void; removing: boolean;
  onToggleSelectable?: (next: boolean) => void;
}) {
  return (
    <div className="group grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 py-2.5 border-b border-border last:border-0 text-sm">
      <div className="min-w-0">
        <span className="text-foreground">{item.name}</span>
        {item.category && <span className="ml-2 text-xs text-muted-foreground">{item.category}</span>}
        {item.notes && <p className="mt-0.5 text-xs text-muted-foreground truncate">{item.notes}</p>}
        {item.clientSelectable && (
          <p className="mt-0.5 text-xs text-primary">Couple can select (max ×{item.maxQuantity ?? item.quantity})</p>
        )}
        {item.clientSubmittedQuantity != null && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Submitted ×{item.clientSubmittedQuantity}
            {item.clientDraftQuantity != null && item.clientDraftQuantity !== item.clientSubmittedQuantity
              ? ` · draft ×${item.clientDraftQuantity}`
              : ""}
          </p>
        )}
        {item.addedToEventOrderAt && <p className="mt-0.5 text-xs text-success">✓ In the Event Order</p>}
      </div>
      <span className="text-muted-foreground text-right w-12">×{item.quantity}</span>
      <span className="text-right w-24 font-medium text-foreground" data-testid="inventory-item-unit-price">
        {(() => {
          const { price, inclusionHint } = eventInventoryListPriceLabel(item);
          if (price == null) {
            return <span className="font-normal text-muted-foreground">—</span>;
          }
          return (
            <span className="inline-flex flex-col items-end leading-tight">
              <span>{price}</span>
              {inclusionHint ? (
                <span className="text-[10px] font-normal text-muted-foreground">{inclusionHint}</span>
              ) : null}
            </span>
          );
        })()}
      </span>
      <Badge variant={item.isIncluded ? "outline" : "accent"} className="w-fit justify-self-end">
        {item.isIncluded ? "Included" : "Additional"}
      </Badge>
      {editable ? (
        <div className="flex items-center gap-0.5 justify-self-end">
          {!item.isIncluded && onToggleSelectable && (
            <button
              type="button"
              className="rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onToggleSelectable(!item.clientSelectable)}
              title="Offer this additional item for couple selection"
            >
              {item.clientSelectable ? "Lock" : "Select"}
            </button>
          )}
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

function StartInventory({
  eventId,
  templates,
  preferredTemplateId = null,
}: {
  eventId: string;
  templates: InventoryTemplate[];
  preferredTemplateId?: string | null;
}) {
  const router = useRouter();
  const preferredExists = Boolean(preferredTemplateId && templates.some((t) => t.id === preferredTemplateId));
  const [templateId, setTemplateId] = React.useState<string>(preferredExists ? preferredTemplateId! : "blank");
  const [starting, startTransition] = React.useTransition();
  const [recovering, setRecovering] = React.useState(false);

  const options = [{ value: "blank", label: "Start blank" }, ...templates.map((t) => ({ value: t.id, label: t.name }))];

  // Profile-configured inventory should already exist after booking / prepare-release.
  // Recover silently once so this tab is an editor, not a second setup wizard.
  React.useEffect(() => {
    if (!preferredExists || !preferredTemplateId) return;
    let cancelled = false;
    setRecovering(true);
    void (async () => {
      const result = await ensureEventInventoryAction(eventId, preferredTemplateId);
      if (cancelled) return;
      setRecovering(false);
      if (!result.ok) toast.error(result.message ?? "Could not prepare Event Inventory.");
      else router.refresh();
    })();
    return () => { cancelled = true; };
  }, [eventId, preferredExists, preferredTemplateId, router]);

  function handleStart() {
    startTransition(async () => {
      const result = await ensureEventInventoryAction(eventId, templateId === "blank" ? null : templateId);
      if (!result.ok) toast.error(result.message ?? "Could not start Event Inventory.");
    });
  }

  if (preferredExists) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Inventory</CardTitle>
          <CardDescription>
            Preparing the profile starting inventory template for this event. This is a draft only — not shared and not an invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {recovering ? "Preparing inventory draft…" : "Refreshing…"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Event Inventory</CardTitle>
        <CardDescription>
          Manage this event&apos;s inventory draft and operational inventory state. Creating or
          editing a draft does not share it with the client or create an invoice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="max-w-md text-xs text-muted-foreground">
            No inventory draft yet. Choose a starting inventory template for this event only, or use Release to client portal from Overview when a Setup Profile template is configured. Creating or editing a draft does not share it with the client or create an invoice.
          </p>
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
  eventId, eventInventory, templates, catalogItems, preferredTemplateId = null,
}: {
  eventId: string;
  eventInventory: EventInventoryWithDetails | null;
  templates: InventoryTemplate[];
  catalogItems: InventoryItem[];
  preferredTemplateId?: string | null;
}) {
  const router = useRouter();
  const [lifecyclePending, startLifecycle] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  /** Server actions revalidate, but this panel is props-driven — refresh so status CTAs update. */
  function runLifecycle(fn: () => Promise<void>) {
    startLifecycle(async () => {
      await fn();
      router.refresh();
    });
  }

  if (!eventInventory) {
    return (
      <StartInventory
        eventId={eventId}
        templates={templates}
        preferredTemplateId={preferredTemplateId}
      />
    );
  }

  const inv = eventInventory;
  const isFinalized = inv.status === "finalized";
  const canShare =
    inv.status === "draft" ||
    inv.status === "shared" ||
    inv.status === "confirmed" ||
    inv.status === "changes_requested";
  const canConfirm = inv.status === "submitted";
  const billableTotal = inv.items.reduce(
    (sum, i) => i.isIncluded ? sum : sum + (i.unitPrice ?? 0) * i.quantity,
    0,
  );
  const hasUnpushedItems = inv.items.some((i) => !i.addedToEventOrderAt);
  const selectableCount = inv.items.filter((i) => i.clientSelectable).length;

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
              {hasUnpushedItems && (
                <Button type="button" variant="outline" size="sm" disabled={lifecyclePending}
                  onClick={() => runLifecycle(async () => {
                    const result = await addEventInventoryToEventOrderAction(inv.id, eventId);
                    if (result.ok) {
                      const extra = result.addedTotal > 0 ? ` (${formatMoney(result.addedTotal)} additional)` : " (included — no additional charge)";
                      toast.success(`Added ${result.addedCount} item${result.addedCount === 1 ? "" : "s"}${extra} to the Event Order.`);
                    } else toast.error(result.message ?? "Could not add to Event Order.");
                  })}>
                  Add to Event Order
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" disabled={lifecyclePending}
                onClick={() => runLifecycle(async () => {
                  const result = await reopenEventInventoryAction(inv.id, eventId);
                  if (!result.ok) toast.error(result.message ?? "Could not reopen.");
                })}>
                {lifecyclePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reopen"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {canShare && (
                <>
                  <Button type="button" variant="outline" size="sm" disabled={lifecyclePending}
                    onClick={() => runLifecycle(async () => {
                      const result = await shareEventInventoryAction(inv.id, eventId, "view");
                      if (result.ok) toast.success("Shared for viewing (read-only).");
                      else toast.error(result.message ?? "Could not share.");
                    })}>
                    Share to view
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={lifecyclePending || selectableCount === 0}
                    title={selectableCount === 0 ? "Mark additional items as Select first" : undefined}
                    onClick={() => runLifecycle(async () => {
                      const result = await shareEventInventoryAction(inv.id, eventId, "select");
                      if (result.ok) toast.success("Shared for couple selection.");
                      else toast.error(result.message ?? "Could not share.");
                    })}>
                    Share for selection
                  </Button>
                </>
              )}
              {canConfirm && (
                <>
                  <Button type="button" variant="outline" size="sm" disabled={lifecyclePending}
                    onClick={() => runLifecycle(async () => {
                      const note = window.prompt("Note for the couple (optional)") ?? "";
                      const result = await requestInventorySelectionChangesAction(inv.id, eventId, note);
                      if (result.ok) toast.success("Asked the couple for changes.");
                      else toast.error(result.message ?? "Could not request changes.");
                    })}>
                    Request changes
                  </Button>
                  <Button type="button" size="sm" disabled={lifecyclePending}
                    onClick={() => runLifecycle(async () => {
                      const result = await confirmInventorySelectionsAction(inv.id, eventId);
                      if (result.ok) toast.success("Selections confirmed.");
                      else toast.error(result.message ?? "Could not confirm.");
                    })}>
                    Confirm selections
                  </Button>
                </>
              )}
              <Button type="button" size="sm" disabled={lifecyclePending || inv.items.length === 0 || inv.status === "submitted"}
                onClick={() => runLifecycle(async () => {
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
          Included items stay informational. Mark additional items as Select, then Share for selection
          so the couple can choose quantities. Confirm their submission before Finalize → Add to Event Order.
          Additional-cost total:{" "}
          <span className="font-medium text-foreground">{formatMoney(billableTotal)}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {inv.items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nothing added yet.</p>
        ) : (
          <div>
            {inv.items.map((item) => (
              <ItemRow key={item.id} item={item} eventInventoryId={inv.id} eventId={eventId} catalogItems={catalogItems}
                editable={!isFinalized && inv.status !== "submitted"}
                onRemove={() => handleRemove(item)} removing={removingId === item.id}
                onToggleSelectable={(next) => runLifecycle(async () => {
                  const result = await setInventoryItemClientSelectableAction(inv.id, eventId, item.id, next);
                  if (!result.ok) toast.error(result.message ?? "Could not update selection flag.");
                })}
              />
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
