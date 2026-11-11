"use client";

import { useEffect, useState } from "react";

import {
  EventOrderPortalView,
  type PortalEventOrderViewModel,
} from "@/components/portal/event-order-view";

/**
 * Client-facing Event Order — last shared snapshot + optional accept.
 * Not an invoice, contract, or checklist. Share ≠ agreement.
 */
export function EventOrderPortalSection({ token }: { token: string }) {
  const [data, setData] = useState<PortalEventOrderViewModel | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/portal/event-order?token=${token}`)
      .then((r) => r.json())
      .then((d: { eventOrder: PortalEventOrderViewModel | null }) => setData(d.eventOrder))
      .catch(() => setData(null));
  }, [token]);

  if (data === undefined) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><div className="animate-pulse">Loading…</div></div>;
  }

  return (
    <EventOrderPortalView
      data={data}
      paymentsHref="#payments"
      token={token}
      onAccepted={setData}
    />
  );
}
