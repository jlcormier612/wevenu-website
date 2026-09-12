"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";

type PortalEventOrderLine = {
  id: string;
  description: string;
  quantity: number;
  amount: number;
  sectionId: string | null;
  sectionName: string | null;
  isIncluded: boolean | null;
  unit: string | null;
  unitPrice: number | null;
  notes: string | null;
};
type PortalEventOrder = {
  id: string;
  status: string;
  revision: number;
  sharedAt: string | null;
  lines: PortalEventOrderLine[];
};

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatOptionalMoney(n: number | null): string {
  if (n == null) return "—";
  return formatMoney(n);
}

/**
 * Client-facing Event Order — last shared snapshot only (read-only).
 * Not an invoice, contract, or checklist.
 */
export function EventOrderPortalSection({ token }: { token: string }) {
  const [data, setData] = useState<PortalEventOrder | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/portal/event-order?token=${token}`)
      .then((r) => r.json())
      .then((d: { eventOrder: PortalEventOrder | null }) => setData(d.eventOrder))
      .catch(() => setData(null));
  }, [token]);

  if (data === undefined) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><div className="animate-pulse">Loading…</div></div>;
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-sm font-medium text-heading">Not shared yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your venue has not shared an Event Order for this event. This is not your invoice or contract.
        </p>
      </div>
    );
  }

  const pricedTotal = data.lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const sectionKeys = [...new Set(data.lines.map((l) => l.sectionId))];

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-heading">What you&apos;re receiving</h2>
          <Badge variant="success">Shared</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Your Event Order — the delivery list for your event. Not your invoice or contract.
        </p>
        {data.sharedAt && (
          <p className="text-xs text-muted-foreground">
            Updated {new Date(data.sharedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>

      {data.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No delivery items on this shared Event Order.</p>
      ) : (
        sectionKeys.map((sectionId) => {
          const lines = data.lines.filter((l) => l.sectionId === sectionId);
          const sectionName = lines[0]?.sectionName;
          return (
            <div key={sectionId ?? "general"} className="space-y-2">
              {sectionName && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sectionName}</p>}
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {lines.map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{l.description}</p>
                      <p className="text-xs text-muted-foreground">
                        ×{l.quantity}{l.unit ? ` ${l.unit}` : ""}
                        {" · "}
                        {l.isIncluded === false ? "Additional" : "Included"}
                      </p>
                      {l.notes && <p className="mt-1 text-xs text-muted-foreground">{l.notes}</p>}
                    </div>
                    <p className="shrink-0 text-sm font-medium text-foreground">{formatOptionalMoney(l.unitPrice == null ? null : l.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {pricedTotal > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery subtotal (for reference)</span>
            <span className="font-medium">{formatMoney(pricedTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Prices shown for your reference. Amount due is on Payments.
          </p>
          <Link href={`#payments`} className="inline-block text-sm font-medium text-primary hover:underline">
            View what you owe
          </Link>
        </div>
      )}
    </div>
  );
}
