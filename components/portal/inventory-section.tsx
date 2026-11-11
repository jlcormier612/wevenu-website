"use client";

import { useCallback, useEffect, useState } from "react";

import {
  InventoryPortalView,
  type PortalInventoryViewModel,
} from "@/components/portal/inventory-view";

/**
 * Event Inventory in the couple's portal — view or select mode depending on venue share.
 */
export function InventoryPortalSection({ token }: { token: string }) {
  const [data, setData] = useState<PortalInventoryViewModel | null | undefined>(undefined);

  const load = useCallback(() => {
    fetch(`/api/portal/inventory?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d: { inventory: PortalInventoryViewModel | null }) => setData(d.inventory))
      .catch(() => setData(null));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }

  return <InventoryPortalView data={data} token={token} onMutated={load} />;
}
