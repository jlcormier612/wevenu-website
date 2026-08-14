"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

type PortalInventoryItem = {
  id: string; name: string; category: string | null; quantity: number;
  unitPrice: number | null; isIncluded: boolean; notes: string | null;
};
type PortalInventory = { id: string; status: string; finalizedAt: string | null; items: PortalInventoryItem[] };

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Event Inventory, read-only, in the couple's own portal (D5A). Plain-
 * language framing per the brief's own test — "What is included? What can
 * I choose? What costs extra? What have I selected?" — no database
 * terminology (no "sort_order," no "provenance," no raw status strings).
 * The couple never edits here; see app/api/portal/inventory/route.ts for
 * why (judgment call, documented there and in the D5A report).
 */
export function InventoryPortalSection({ token }: { token: string }) {
  const [data, setData] = useState<PortalInventory | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/portal/inventory?token=${token}`)
      .then((r) => r.json())
      .then((d: { inventory: PortalInventory | null }) => setData(d.inventory))
      .catch(() => setData(null));
  }, [token]);

  if (data === undefined) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><div className="animate-pulse">Loading…</div></div>;
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-3">🪑</div>
        <p className="text-sm font-medium text-heading">Nothing to show yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your venue will share what's included in your event here once it's ready.
        </p>
      </div>
    );
  }

  const included = data.items.filter((i) => i.isIncluded);
  const additional = data.items.filter((i) => !i.isIncluded);
  const additionalTotal = additional.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-heading">What's included in your event</h2>
        <Badge variant={data.status === "finalized" ? "success" : "default"}>
          {data.status === "finalized" ? "Finalized" : "In progress"}
        </Badge>
      </div>

      {included.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Included</p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {included.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-foreground">{item.name}</p>
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <span className="text-xs text-muted-foreground">×{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {additional.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional cost</p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {additional.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-foreground">{item.name}</p>
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{item.unitPrice != null ? formatMoney(item.unitPrice) : "—"}</p>
                  <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-right text-sm text-muted-foreground">Additional total: <span className="font-medium text-foreground">{formatMoney(additionalTotal)}</span></p>
        </div>
      )}

      {data.items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nothing added yet.</p>
      )}
    </div>
  );
}
