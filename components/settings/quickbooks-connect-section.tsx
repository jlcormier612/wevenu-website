"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  disconnectQuickBooksAction,
  listQuickBooksIncomeAccountsAction,
  retryQuickBooksSyncAction,
  selectQuickBooksIncomeAccountAction,
} from "@/app/(app)/settings/actions";
import { SetupGuideLink } from "@/components/help/setup-guide-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectableIncomeAccount } from "@/lib/quickbooks/income-accounts";
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

/**
 * QuickBooks refuses to create the default Service Item without an income
 * account and offers no default of its own, so this choice is required
 * before invoices or refunds can sync. Nothing is preselected — a wrong
 * guess here would post a venue's event revenue to the wrong P&L line.
 */
function IncomeAccountPicker({ connection }: { connection: QuickBooksConnection }) {
  const [accounts, setAccounts] = React.useState<SelectableIncomeAccount[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [choice, setChoice] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [saving, startSave] = React.useTransition();

  const selectedId = connection.defaultIncomeAccountQuickBooksId;
  const selectedName = connection.defaultIncomeAccountName;

  function loadAccounts() {
    setLoading(true);
    setLoadError(null);
    listQuickBooksIncomeAccountsAction().then((result) => {
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setAccounts(result.accounts);
      if (result.accounts.length === 0) {
        setLoadError("QuickBooks returned no income accounts we can use. Add one in QuickBooks, then refresh this list.");
      }
    }).catch(() => {
      // Without this the button spins forever on a dropped request and the
      // venue is left with no way to retry and nothing explaining why.
      setLoading(false);
      setLoadError("We couldn't reach QuickBooks just now. Try again in a moment.");
    });
  }

  function handleSave() {
    if (!choice) return;
    startSave(async () => {
      try {
        const result = await selectQuickBooksIncomeAccountAction(choice);
        if (result.ok) toast.success("Income account saved.");
        else toast.error(result.message ?? "Could not save that account.");
      } catch {
        toast.error("We couldn't save that account. Try again in a moment.");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">Income account</p>
        <p className="text-xs text-muted-foreground">
          Choose the QuickBooks income account where you&apos;d like to record revenue from your Hello to Cheers event invoices.
        </p>
        <p className="text-xs text-muted-foreground">
          Hello to Cheers creates a service item called “Hello to Cheers Services” in QuickBooks using your selected income account.
        </p>
        <p className="text-xs text-muted-foreground">
          Not sure which account to choose? Your accountant or bookkeeper can help you select the right one for your business.
        </p>
      </div>

      {selectedId ? (
        <div className="flex items-start gap-2 rounded-lg border border-success/25 bg-success/5 px-3 py-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="text-xs text-foreground">
            Using <span className="font-medium">{selectedName ?? `account ${selectedId}`}</span>.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-foreground">
            Once you&apos;ve selected an income account, your invoices and refunds can begin syncing with QuickBooks.
          </p>
        </div>
      )}

      {accounts === null ? (
        <Button type="button" variant="outline" size="sm" onClick={loadAccounts} disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Loading accounts…</>
          ) : (
            selectedId ? "Change account" : "Choose an account"
          )}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select an income account…" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={handleSave} disabled={!choice || saving}>
            {saving ? (<><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</>) : "Save"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={loadAccounts} disabled={loading}>
            Refresh list
          </Button>
        </div>
      )}

      {loadError && <p className="text-xs text-destructive">{loadError}</p>}
    </div>
  );
}

function formatSyncWhen(iso: string): string {
  const when = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWhen = new Date(when);
  startOfWhen.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - startOfWhen.getTime()) / 86_400_000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return when.toLocaleDateString();
}

function syncActivityLabel(entry: QuickBooksSyncLogEntry): string {
  const entity = ENTITY_LABEL[entry.entityType] ?? entry.entityType;
  const when = formatSyncWhen(entry.createdAt);
  if (entry.outcome === "succeeded") return `${entity} synced successfully — ${when}`;
  if (entry.outcome === "failed") return `${entity} sync retrying — ${when}`;
  return `${entity} sync failed — ${when}`;
}

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
                <span className="truncate text-foreground">{syncActivityLabel(entry)}</span>
                {entry.message && entry.outcome !== "succeeded" ? (
                  <span className="truncate text-muted-foreground">{entry.message}</span>
                ) : null}
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
          {!isConnected && !isError
            ? "Spend less time entering information twice. Connect QuickBooks Online to automatically sync your venue's customers, invoices, payments and refunds with your accounting records."
            : isError
              ? "QuickBooks needs you to renew your connection before syncing can continue. Sign in to your existing Intuit account and authorize the connection again."
              : "Your venue's supported customers, invoices, payments and refunds sync automatically with your connected QuickBooks company."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/5 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
              <div className="space-y-0.5">
                {connection?.companyName ? (
                  <>
                    <p className="text-sm font-medium text-foreground">{connection.companyName}</p>
                    <p className="text-xs text-muted-foreground">Connected QuickBooks company</p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-foreground">Your QuickBooks account is connected.</p>
                )}
              </div>
            </div>
            {connection?.lastHealthCheckOk === false && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Connected, last sync failed</p>
                  <p className="text-xs text-muted-foreground">
                    Your account is still connected, but a recent accounting record could not be synced successfully.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hello to Cheers automatically retries eligible syncs. Review your recent sync activity and any available details to identify items that need attention.
                  </p>
                  {connection.lastError ? (
                    <p className="text-xs text-muted-foreground">{connection.lastError}</p>
                  ) : null}
                </div>
              </div>
            )}
            <IncomeAccountPicker connection={connection} />
            <RecentSyncActivity entries={syncLog} />
            <div>
              <SetupGuideLink
                href="/help/how-to-connect-quickbooks-online"
                label="Learn more about your QuickBooks integration"
              />
            </div>
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
          </div>
        ) : isError ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Let&apos;s get your accounting connected again.</p>
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
            <p className="text-xs text-muted-foreground">
              Be sure to select the same QuickBooks company you were previously using.
            </p>
            <div>
              <SetupGuideLink
                href="/help/how-to-connect-quickbooks-online"
                label="Need a hand? Follow our step-by-step QuickBooks setup guide."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Manage your events and client financials in Hello to Cheers while keeping your books up to date in QuickBooks.
            </p>
            {!isConfigured ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  QuickBooks isn&apos;t ready to start in this environment yet. A working Connect
                  button will appear here when Hello to Cheers can open QuickBooks onboarding.
                </p>
              </div>
            ) : (
              <>
                <a
                  href={connectUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Connect QuickBooks
                </a>
                <div>
                  <SetupGuideLink
                    href="/help/how-to-connect-quickbooks-online"
                    label="Need a hand? Follow our step-by-step QuickBooks setup guide."
                  />
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
