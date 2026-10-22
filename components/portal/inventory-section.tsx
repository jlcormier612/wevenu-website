"use client";

import { useEffect, useState } from "react";

import {
  InventoryPortalView,
  type PortalInventoryViewModel,
} from "@/components/portal/inventory-view";

/**
 * Event Inventory, read-only, in the couple's own portal (D5A).
 */
export function InventoryPortalSection({ token }: { token: string }) {
  const [data, setData] = useState<PortalInventoryViewModel | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/portal/inventory?token=${token}`)
      .then((r) => r.json())
      .then((d: { inventory: PortalInventoryViewModel | null }) => setData(d.inventory))
      .catch(() => setData(null));
  }, [token]);

  if (data === undefined) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><div className="animate-pulse">Loading…</div></div>;
  }

  return <InventoryPortalView data={data} />;
}
