"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

type PortalEventOrderLine = {
  id: string; description: string; quantity: number; amount: number;
  sectionId: string | null; sectionName: string | null;
};
type PortalEventOrder = { id: string; status: string; revision: number; sharedAt: string | null; lines: PortalEventOrderLine[] };

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Event Order, read-only, in the couple's own portal (D5C). Same judgment
 * call as D5A's Inventory portal section: no client-side editing (Event
 * Order remains a single-party venue record, per D3's own confirmed
 * finding — this phase adds visibility, not collaboration, which was
 * never asked for and matches "do not invent Event Order collaboration
 * where none exists," §50).
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
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm font-medium text-heading">Nothing to show yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your venue will share the details for your event here once they're ready.
        </p>
      </div>
    );
  }

  const total = data.lines.reduce((sum, l) => sum + l.amount, 0);
  const sections = [...new Set(data.lines.map((l) => l.sectionId))];

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-heading">Your event order</h2>
        <Badge variant="success">Ready</Badge>
      </div>

      {sections.map((sectionId) => {
        const lines = data.lines.filter((l) => l.sectionId === sectionId);
        const sectionName = lines[0]?.sectionName;
        return (
          <div key={sectionId ?? "general"} className="space-y-2">
            {sectionName && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sectionName}</p>}
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-foreground">{l.description}</p>
                    <p className="text-xs text-muted-foreground">×{l.quantity}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{formatMoney(l.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {data.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nothing added yet.</p>
      ) : (
        <p className="text-right text-sm text-muted-foreground">Total: <span className="font-medium text-foreground">{formatMoney(total)}</span></p>
      )}
    </div>
  );
}
