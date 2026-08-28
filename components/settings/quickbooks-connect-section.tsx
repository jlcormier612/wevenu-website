"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { disconnectQuickBooksAction, retryQuickBooksSyncAction } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { QuickBooksConnection, QuickBooksEntityType } from "@/lib/quickbooks/types";
import type { QuickBooksSyncLogEntry } from "@/lib/quickbooks/service";
import { buildQuickBooksConnectUrl } from "@/lib/quickbooks/config";

export { buildQuickBooksConnectUrl };

const ENTITY_LABEL: Record<string, string> = {
  customer: "Customer", invoice: "Invoice", payment: "Payment", refund: "Refund",
};

const OUTCOME_BADGE: Record<QuickBooksSyncLogEntry["outcome"], { variant: "success" | "warning" | "destructive"; label: string }> = {
  succeeded: { variant: "success", label: "Synced" },
  failed: { variant: "warning", label: "Retrying" },
  dead_lettered: { variant: "destructive", label: "Failed" },
};

function RecentSyncActivity({ entries }: { entries: QuickBooksSyncLogEntry[] }) {
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  if (entries.length === 0) return null;

  function handleRetry(entry: QuickBooksSyncLogEntry) {
    setRetryingId(entry.id);
    retryQuickBooksSyncAction(entry.entityType as QuickBooksEntityType, entry.entityId).then((result) => {
      setRetryingId(null);
      if (result.ok) toast.success("Retrying sync to QuickBooks…");
      else toast.error(result.message ?? "Could not retry this sync.");
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">Recent sync activity</p>
      <ul className="space-y-1.5">
        {entries.map((entry) => {
          const badge = OUTCOME_BADGE[entry.outcome];
          return (
            <li key={entry.id} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="truncate text-foreground">{ENTITY_LABEL[entry.entityType] ?? entry.entityType}</span>
                {entry.message && <span className="truncate text-muted-foreground">{entry.message}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {entry.outcome === "dead_lettered" && (
                  <button
                    type="button"
                    onClick={() => handleRetry(entry)}
                    disabled={retryingId === entry.id}
                    className="font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {retryingId === entry.id ? "Retrying…" : "Retry now"}
                  </button>
                )}
                <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function QuickBooksConnectSection({
  venueId, connection, syncLog = [], returnTo = "settings", connectUrl: connectUrlProp,
}: {
  venueId: string;
  connection: QuickBooksConnection | null;
  syncLog?: QuickBooksSyncLogEntry[];
  returnTo?: "settings" | "onboarding";
  /** Server-built OAuth URL — uses runtime QUICKBOOKS_CLIENT_ID when public build arg is missing. */
  connectUrl?: string | null;
}) {
  const searchParams = useSearchParams();
  const qbSuccess = searchParams.get("quickbooks_success");
  const qbError = searchParams.get("quickbooks_error");
  const [disconnecting, startDisconnect] = React.useTransition();

  React.useEffect(() => {
    if (qbSuccess) toast.success("QuickBooks connected successfully.");
    if (qbError) toast.error(`QuickBooks error: ${qbError}`);
  }, [qbSuccess, qbError]);

  const connectUrl = connectUrlProp ?? buildQuickBooksConnectUrl(venueId, returnTo);
  const isConfigured = !!connectUrl;
  const isConnected = connection?.status === "connected";
  const isError = connection?.status === "error";

  function handleDisconnect() {
    if (!confirm("Disconnect QuickBooks? Future invoices, payments, and refunds will stop syncing until you reconnect.")) return;
    startDisconnect(async () => {
      const result = await disconnectQuickBooksAction();
      if (result.ok) toast.success("QuickBooks disconnected.");
      else toast.error(result.message ?? "Could not disconnect QuickBooks.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            QuickBooks Online
          </CardTitle>
          {isConnected && connection?.lastHealthCheckOk === false && (
            <Badge variant="warning">Connected, last sync failed</Badge>
          )}
          {isConnected && connection?.lastHealthCheckOk !== false && (
            <Badge variant="success">Connected</Badge>
          )}
          {isError && <Badge variant="destructive">Reconnect required</Badge>}
          {!isConnected && !isError && <Badge variant="muted">Not connected</Badge>}
        </div>
        <CardDescription>
          Connect QuickBooks Online to automatically sync your customers, invoices,
          payments, and refunds — no manual re-entry, no separate bookkeeping step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/5 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {connection?.companyName ? `Connected to ${connection.companyName}.` : "QuickBooks is connected."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Customers, invoices, payments, and refunds sync automatically as they happen.
                </p>
              </div>
            </div>
            {connection?.lastHealthCheckOk === false && connection.lastError && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">The last sync attempt failed.</p>
                  <p className="text-xs text-muted-foreground">{connection.lastError}</p>
                  <p className="text-xs text-muted-foreground">It will retry automatically.</p>
                </div>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-muted-foreground"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Disconnecting…</>
              ) : (
                "Disconnect QuickBooks"
              )}
            </Button>
            <RecentSyncActivity entries={syncLog} />
          </div>
        ) : isError ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Your QuickBooks connection needs to be reconnected.</p>
                {connection?.lastError && <p className="text-xs text-muted-foreground">{connection.lastError}</p>}
              </div>
            </div>
            {isConfigured && (
              <a
                href={connectUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Reconnect QuickBooks
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {!isConfigured ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  QuickBooks isn&apos;t available for your account yet. Contact support to get this connected.
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {[
                    "Customers, invoices, payments, and refunds sync automatically",
                    "Every sync retries on failure — nothing is silently dropped",
                    "One-directional: Hello to Cheers stays the source of truth",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={connectUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Connect with QuickBooks
                </a>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
