"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { retryQuickBooksSyncAction } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import type { QuickBooksEntityType } from "@/lib/quickbooks/types";

type QuickBooksSyncStatus = "not_synced" | "pending" | "synced" | "failed";

/**
 * `not_synced` renders nothing — never show a "not synced" badge to a venue
 * that has no QuickBooks connection at all, consistent with
 * StripeConnectSection's "honestly absent, not misleading" convention.
 *
 * A failed sync gets an inline "Retry now" action (docs/quickbooks-online-
 * architecture.md §7) when the caller provides entityType/entityId — the
 * two call sites that don't (none currently) simply show the badge alone.
 */
export function QuickBooksSyncStatusBadge({
  status,
  lastError,
  entityType,
  entityId,
}: {
  status: QuickBooksSyncStatus;
  lastError?: string | null;
  entityType?: QuickBooksEntityType;
  entityId?: string;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = React.useState(false);

  if (status === "not_synced") return null;

  if (status === "pending") {
    return <Badge variant="warning">Syncing to QuickBooks…</Badge>;
  }

  if (status === "synced") {
    return <Badge variant="success">Synced to QuickBooks</Badge>;
  }

  function handleRetry() {
    if (!entityType || !entityId) return;
    setRetrying(true);
    retryQuickBooksSyncAction(entityType, entityId).then((result) => {
      setRetrying(false);
      if (result.ok) { toast.success("Retrying sync to QuickBooks…"); router.refresh(); }
      else toast.error(result.message ?? "Could not retry this sync.");
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="destructive" title={lastError ?? undefined}>
        QuickBooks sync failed
      </Badge>
      {entityType && entityId && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Retry now
        </button>
      )}
    </span>
  );
}
