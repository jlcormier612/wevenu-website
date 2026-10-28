"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type PortalInventoryItemView = {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unitPrice: number | null;
  isIncluded: boolean;
  notes: string | null;
  /** Catalog/event photo when the venue shared one; omit or null = no thumbnail. */
  imageUrl?: string | null;
  clientSelectable?: boolean;
  maxQuantity?: number | null;
  clientDraftQuantity?: number | null;
  clientSubmittedQuantity?: number | null;
};

function ItemPhoto({ src, alt }: { src: string | null | undefined; alt: string }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="h-12 w-12 shrink-0 rounded-md border border-border/60 bg-muted/30 object-contain"
      data-testid="inventory-item-photo"
    />
  );
}

export type PortalInventoryViewModel = {
  id: string;
  status: string;
  finalizedAt: string | null;
  collaborationMode?: "view" | "select";
  items: PortalInventoryItemView[];
};

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const STATUS_COPY: Record<string, { label: string; hint: string }> = {
  shared: {
    label: "Ready for your choices",
    hint: "Save a draft anytime. Submit when you’re ready — your venue will review before anything is confirmed.",
  },
  changes_requested: {
    label: "Changes requested",
    hint: "Your venue asked you to update your selections. Save a draft, then submit again.",
  },
  submitted: {
    label: "Submitted — awaiting venue review",
    hint: "Your venue is reviewing what you submitted. Quantities are locked until they confirm or ask for changes.",
  },
  confirmed: {
    label: "Confirmed",
    hint: "Your venue confirmed these inventory choices. They’ll appear on your Event Order when shared.",
  },
  finalized: {
    label: "Finalized",
    hint: "This inventory arrangement is locked.",
  },
};

const INVENTORY_INTRO =
  "View the items your venue has listed for your event, including package-included items and available add-ons.";

/**
 * Couple-facing Inventory presentation. Shared by portal section and staff preview.
 * Select mode adds draft/submit controls; view mode stays read-only.
 */
export function InventoryPortalView({
  data,
  staffPreviewLabel,
  token,
  onMutated,
}: {
  data: PortalInventoryViewModel | null;
  staffPreviewLabel?: string | null;
  /** When set (live portal), enables save/submit for select mode. */
  token?: string;
  onMutated?: () => void;
}) {
  const [qtyById, setQtyById] = React.useState<Record<string, number>>({});
  const [pending, setPending] = React.useState<"save" | "submit" | null>(null);

  React.useEffect(() => {
    if (!data) return;
    const next: Record<string, number> = {};
    for (const item of data.items) {
      if (!item.clientSelectable) continue;
      const draft =
        item.clientDraftQuantity ??
        item.clientSubmittedQuantity ??
        item.quantity;
      next[item.id] = Number(draft) || 0;
    }
    setQtyById(next);
  }, [data]);

  if (!data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center" data-testid="inventory-portal-empty">
        <div className="text-4xl mb-3">🪑</div>
        <p className="text-sm font-medium text-heading">Not shared yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Your venue has not shared this event&apos;s inventory yet. When they do, you&apos;ll see
          package-included items and any available add-ons here. This is not a request form and not
          your Event Order.
        </p>
      </div>
    );
  }

  const selectMode = data.collaborationMode === "select";
  const canEdit =
    !!token &&
    selectMode &&
    (data.status === "shared" || data.status === "changes_requested");
  const statusMeta = STATUS_COPY[data.status] ?? {
    label: data.status === "finalized" ? "Finalized" : "In progress",
    hint: selectMode
      ? "Review package-included items and any optional extras your venue offered."
      : "Event inventory from your venue — read-only. For the delivery list, open Event Order.",
  };

  const included = data.items.filter((i) => i.isIncluded);
  const additional = data.items.filter((i) => !i.isIncluded);
  const selectable = additional.filter((i) => i.clientSelectable);

  const displayQty = (item: PortalInventoryItemView): number => {
    if (item.clientSelectable && (canEdit || qtyById[item.id] != null)) {
      return qtyById[item.id] ?? item.clientDraftQuantity ?? item.quantity;
    }
    if (item.clientSubmittedQuantity != null) return item.clientSubmittedQuantity;
    return item.quantity;
  };

  const additionalTotal = additional.reduce((sum, i) => {
    const qty = displayQty(i);
    return sum + (i.unitPrice ?? 0) * qty;
  }, 0);

  async function saveDraft() {
    if (!token || !canEdit) return;
    setPending("save");
    try {
      const selections = selectable.map((i) => ({
        itemId: i.id,
        quantity: qtyById[i.id] ?? 0,
      }));
      const res = await fetch("/api/portal/inventory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, selections }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!json.ok) toast.error(json.message ?? "Could not save draft.");
      else {
        toast.success("Draft saved.");
        onMutated?.();
      }
    } catch {
      toast.error("Could not save draft.");
    } finally {
      setPending(null);
    }
  }

  async function submitSelections() {
    if (!token || !canEdit) return;
    setPending("submit");
    try {
      const selections = selectable.map((i) => ({
        itemId: i.id,
        quantity: qtyById[i.id] ?? 0,
      }));
      const saveRes = await fetch("/api/portal/inventory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, selections }),
      });
      const saveJson = (await saveRes.json()) as { ok?: boolean; message?: string };
      if (!saveJson.ok) {
        toast.error(saveJson.message ?? "Could not save before submit.");
        return;
      }
      const res = await fetch("/api/portal/inventory/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!json.ok) toast.error(json.message ?? "Could not submit.");
      else {
        toast.success("Selections submitted to your venue.");
        onMutated?.();
      }
    } catch {
      toast.error("Could not submit.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6" data-testid="inventory-portal-view">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">
            {selectMode ? "Your inventory choices" : "Inventory"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5" data-testid="inventory-portal-intro">
            {INVENTORY_INTRO}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{statusMeta.hint}</p>
        </div>
        {staffPreviewLabel ? (
          <Badge variant="secondary">{staffPreviewLabel}</Badge>
        ) : (
          <Badge
            variant={
              data.status === "finalized" || data.status === "confirmed"
                ? "success"
                : data.status === "submitted"
                  ? "accent"
                  : "default"
            }
          >
            {statusMeta.label}
          </Badge>
        )}
      </div>

      {included.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Package-included
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {included.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <ItemPhoto src={item.imageUrl} alt={item.name} />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{item.name}</p>
                    {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                    <p
                      className="text-[11px] text-muted-foreground mt-0.5"
                      data-testid="inventory-item-included-label"
                    >
                      Included — no extra charge
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">×{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {additional.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {selectMode ? "Optional / additional" : "Additional fee"}
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {additional.map((item) => {
              const max = item.maxQuantity ?? item.quantity;
              const qty = displayQty(item);
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ItemPhoto src={item.imageUrl} alt={item.name} />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{item.name}</p>
                      {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                      <p
                        className="text-[11px] text-muted-foreground mt-0.5"
                        data-testid="inventory-item-additional-label"
                      >
                        {item.unitPrice != null
                          ? `Additional fee — ${formatMoney(item.unitPrice)} each`
                          : "Additional fee — price set by your venue"}
                        {item.clientSelectable ? ` · optional · up to ×${max}` : null}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.unitPrice != null ? formatMoney(item.unitPrice) : "—"}
                      <span className="text-xs font-normal text-muted-foreground"> each</span>
                    </p>
                    {canEdit && item.clientSelectable ? (
                      <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        Qty
                        <input
                          type="number"
                          min={0}
                          max={max}
                          step={1}
                          value={qty}
                          data-testid={`inventory-qty-${item.id}`}
                          className="w-16 rounded border border-border bg-background px-1.5 py-1 text-sm text-foreground"
                          onChange={(e) => {
                            const n = Math.max(0, Math.min(max, Number(e.target.value) || 0));
                            setQtyById((prev) => ({ ...prev, [item.id]: n }));
                          }}
                        />
                      </label>
                    ) : (
                      <p className="text-xs text-muted-foreground">×{qty}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-right text-sm text-muted-foreground">
            Additional total:{" "}
            <span className="font-medium text-foreground">{formatMoney(additionalTotal)}</span>
          </p>
        </div>
      )}

      {data.items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nothing added yet.</p>
      )}

      {canEdit && selectable.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending != null}
            data-testid="inventory-save-draft"
            onClick={() => void saveDraft()}
          >
            {pending === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save draft"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending != null}
            data-testid="inventory-submit"
            onClick={() => void submitSelections()}
          >
            {pending === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit selections"}
          </Button>
        </div>
      )}
    </div>
  );
}
