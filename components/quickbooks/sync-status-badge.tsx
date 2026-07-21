import { Badge } from "@/components/ui/badge";

type QuickBooksSyncStatus = "not_synced" | "pending" | "synced" | "failed";

/**
 * `not_synced` renders nothing — never show a "not synced" badge to a venue
 * that has no QuickBooks connection at all, consistent with
 * StripeConnectSection's "honestly absent, not misleading" convention.
 */
export function QuickBooksSyncStatusBadge({
  status,
  lastError,
}: {
  status: QuickBooksSyncStatus;
  lastError?: string | null;
}) {
  if (status === "not_synced") return null;

  if (status === "pending") {
    return <Badge variant="warning">Syncing to QuickBooks…</Badge>;
  }

  if (status === "synced") {
    return <Badge variant="success">Synced to QuickBooks</Badge>;
  }

  return (
    <Badge variant="destructive" title={lastError ?? undefined}>
      QuickBooks sync failed
    </Badge>
  );
}
