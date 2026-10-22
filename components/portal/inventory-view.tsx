"use client";

import { Badge } from "@/components/ui/badge";

export type PortalInventoryItemView = {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unitPrice: number | null;
  isIncluded: boolean;
  notes: string | null;
};

export type PortalInventoryViewModel = {
  id: string;
  status: string;
  finalizedAt: string | null;
  items: PortalInventoryItemView[];
};

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Couple-facing Inventory presentation. Shared by portal section and staff preview.
 */
export function InventoryPortalView({
  data,
  staffPreviewLabel,
}: {
  data: PortalInventoryViewModel | null;
  staffPreviewLabel?: string | null;
}) {
  if (!data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center" data-testid="inventory-portal-empty">
        <div className="text-4xl mb-3">🪑</div>
        <p className="text-sm font-medium text-heading">Nothing to show yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your venue will share what&apos;s included in your event here once it&apos;s ready.
        </p>
      </div>
    );
  }

  const included = data.items.filter((i) => i.isIncluded);
  const additional = data.items.filter((i) => !i.isIncluded);
  const additionalTotal = additional.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6" data-testid="inventory-portal-view">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-heading">What&apos;s included in your event</h2>
        {staffPreviewLabel ? (
          <Badge variant="secondary">{staffPreviewLabel}</Badge>
        ) : (
          <Badge variant={data.status === "finalized" ? "success" : "default"}>
            {data.status === "finalized" ? "Finalized" : "In progress"}
          </Badge>
        )}
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
                  <p className="text-sm font-medium text-foreground">
                    {item.unitPrice != null ? formatMoney(item.unitPrice) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-right text-sm text-muted-foreground">
            Additional total: <span className="font-medium text-foreground">{formatMoney(additionalTotal)}</span>
          </p>
        </div>
      )}

      {data.items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nothing added yet.</p>
      )}
    </div>
  );
}
