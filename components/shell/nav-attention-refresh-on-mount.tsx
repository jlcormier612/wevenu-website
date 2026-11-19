"use client";

import * as React from "react";

import { requestNavAttentionRefresh } from "@/lib/navigation/attention";

/**
 * Forces a sidebar attention re-fetch after a server mutation that changes
 * badge populations (e.g. markLeadVenueSeen / markVenueToursSeen).
 * Bypasses the Wave 1 soft-nav TTL.
 */
export function NavAttentionRefreshOnMount() {
  React.useEffect(() => {
    requestNavAttentionRefresh();
  }, []);
  return null;
}
