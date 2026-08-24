"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  disconnectFacebookAction,
  getFacebookConnectUrlAction,
  listFacebookLeadFormsAction,
  listFacebookPagesAction,
  selectFacebookLeadFormsAction,
  selectFacebookPageAction,
  setFacebookFormEnabledAction,
} from "@/app/(app)/settings/facebook-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { FacebookConnection, FacebookLeadForm, FacebookLeadLogEntry } from "@/lib/facebook/types";

type Page = { id: string; name: string };
type Form = { id: string; name: string };

function PageFormPicker({ onDone }: { onDone: () => void }) {
  const [step, setStep] = React.useState<"page" | "form">("page");
  const [pages, setPages] = React.useState<Page[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [forms, setForms] = React.useState<Form[] | null>(null);
  const [selectedForms, setSelectedForms] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let cancelled = false;
    listFacebookPagesAction()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setPages(res.pages);
          setLoadError(null);
        } else {
          setPages([]);
          setLoadError(res.message);
          toast.error(res.message);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not load Facebook Pages.";
        setPages([]);
        setLoadError(message);
        toast.error(message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function choosePage(page: Page) {
    startTransition(async () => {
      const result = await selectFacebookPageAction({ pageId: page.id });
      if (!result.ok) {
        toast.error(result.message ?? "Could not select this Page.");
        return;
      }
      const formsResult = await listFacebookLeadFormsAction();
      if (formsResult.ok) {
        setForms(formsResult.forms);
        setStep("form");
      } else toast.error(formsResult.message);
    });
  }

  function toggleForm(id: string) {
    setSelectedForms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmForms() {
    startTransition(async () => {
      const chosen = (forms ?? [])
        .filter((f) => selectedForms.has(f.id))
        .map((f) => ({ formId: f.id, formName: f.name }));
      const result = await selectFacebookLeadFormsAction(chosen);
      if (result.ok) {
        toast.success("Facebook Lead Ads connected.");
        onDone();
      } else toast.error(result.message ?? "Could not save selected forms.");
    });
  }

  if (step === "page") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Select a Page</p>
        {!pages ? (
          <p className="text-xs text-muted-foreground">Loading your Facebook Pages…</p>
        ) : pages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {loadError ?? "No Pages found for this Facebook account."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choosePage(p)}
                disabled={pending}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-heading">Select which Lead Ads forms should feed Hello to Cheers</p>
      {!forms || forms.length === 0 ? (
        <p className="text-xs text-muted-foreground">No Lead Ads forms found on this Page yet.</p>
      ) : (
        <div className="space-y-1.5">
          {forms.map((f) => (
            <label key={f.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <input type="checkbox" checked={selectedForms.has(f.id)} onChange={() => toggleForm(f.id)} />
              {f.name}
            </label>
          ))}
        </div>
      )}
      <Button type="button" size="sm" onClick={confirmForms} disabled={pending || selectedForms.size === 0}>
        {pending ? "Saving…" : "Connect selected forms"}
      </Button>
    </div>
  );
}

export function FacebookConnectSection({
  venueId,
  connection,
  leadForms,
  recentLog,
  connectUrl: connectUrlProp = null,
}: {
  venueId: string;
  connection: FacebookConnection | null;
  leadForms: FacebookLeadForm[];
  recentLog: FacebookLeadLogEntry[];
  /** Server-built OAuth URL — preferred so Connect does not depend on a client server-action round trip. */
  connectUrl?: string | null;
}) {
  const searchParams = useSearchParams();
  const fbSuccess = searchParams.get("facebook_success");
  const fbError = searchParams.get("facebook_error");
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);

  React.useEffect(() => {
    if (fbSuccess) toast.success("Facebook connected — now select a Page.");
    if (fbError) toast.error(`Facebook error: ${fbError}`);
  }, [fbSuccess, fbError]);

  const [connectUrl, setConnectUrl] = React.useState<string | null>(connectUrlProp);
  const [connectUrlLoading, setConnectUrlLoading] = React.useState(!connectUrlProp);

  React.useEffect(() => {
    if (connectUrlProp) {
      setConnectUrl(connectUrlProp);
      setConnectUrlLoading(false);
      return;
    }
    let cancelled = false;
    setConnectUrlLoading(true);
    getFacebookConnectUrlAction(venueId)
      .then((url) => {
        if (!cancelled) {
          setConnectUrl(url);
          setConnectUrlLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnectUrl(null);
          setConnectUrlLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [venueId, connectUrlProp]);

  const isConfigured = !!connectUrl;
  const needsPageSelection = connection?.status === "needs_page_selection";
  const isConnected = connection?.status === "connected";
  const isError = connection?.status === "error";

  async function runDisconnect() {
    setDisconnecting(true);
    try {
      const result = await disconnectFacebookAction();
      if (!result.ok) {
        toast.error(result.message ?? "Could not disconnect Facebook.");
        setDisconnecting(false);
        setConfirmDisconnect(false);
        return;
      }
      toast.success("Facebook disconnected.");
      // Hard navigation so a hung Page-list server action cannot leave stale UI.
      window.location.assign("/settings#facebook");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disconnect Facebook.");
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  }

  const disconnectControls = (
    <div className="flex flex-wrap items-center gap-2">
      {!confirmDisconnect ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-muted-foreground"
          disabled={disconnecting}
          onClick={() => setConfirmDisconnect(true)}
        >
          Disconnect Facebook
        </Button>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Disconnect and clear this Facebook connection?</p>
          <Button type="button" variant="destructive" size="sm" disabled={disconnecting} onClick={() => void runDisconnect()}>
            {disconnecting ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Disconnecting…
              </>
            ) : (
              "Confirm disconnect"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disconnecting}
            onClick={() => setConfirmDisconnect(false)}
          >
            Cancel
          </Button>
        </>
      )}
    </div>
  );

  return (
    <Card id="facebook" className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            Facebook / Instagram Lead Ads
          </CardTitle>
          {isConnected && <Badge variant="success">Connected</Badge>}
          {needsPageSelection && <Badge variant="warning">Select a Page</Badge>}
          {isError && <Badge variant="destructive">Reconnect required</Badge>}
          {!connection && <Badge variant="muted">Not connected</Badge>}
        </div>
        <CardDescription>
          Every lead submitted through your connected Lead Ads forms becomes a Lead in Hello to Cheers automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected || showPicker || needsPageSelection ? (
          <div className="space-y-4">
            {isConnected && !showPicker ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/5 p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">Connected to {connection?.pageName}.</p>
                    <p className="text-xs text-muted-foreground">New leads from your enabled forms sync automatically.</p>
                  </div>
                </div>
                {leadForms.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Connected forms</p>
                    {leadForms.map((f) => (
                      <div key={f.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                        {f.formName ?? f.formId}
                        <Switch checked={f.isEnabled} onCheckedChange={(v) => setFacebookFormEnabledAction(f.formId, v)} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPicker(true)}>
                    Manage connected forms
                  </Button>
                  {disconnectControls}
                </div>
                {recentLog.length > 0 && (
                  <div className="space-y-1.5 rounded-lg border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Recent activity</p>
                    <ul className="space-y-1">
                      {recentLog.slice(0, 10).map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between text-xs">
                          <span>
                            <Badge
                              variant={
                                entry.outcome === "succeeded"
                                  ? "success"
                                  : entry.outcome === "dead_lettered"
                                    ? "destructive"
                                    : "warning"
                              }
                            >
                              {entry.outcome === "succeeded"
                                ? "Imported"
                                : entry.outcome === "dead_lettered"
                                  ? "Failed"
                                  : "Retrying"}
                            </Badge>
                          </span>
                          <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                {needsPageSelection && connection?.lastError ? (
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">This Page is not subscribed to lead notifications yet.</p>
                      <p className="text-xs text-muted-foreground">{connection.lastError}</p>
                    </div>
                  </div>
                ) : null}
                <PageFormPicker onDone={() => setShowPicker(false)} />
                <div className="border-t border-border pt-3">{disconnectControls}</div>
              </>
            )}
          </div>
        ) : isError ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Your Facebook connection needs to be reconnected.</p>
                {connection?.lastError && <p className="text-xs text-muted-foreground">{connection.lastError}</p>}
              </div>
            </div>
            {isConfigured && (
              <a
                href={connectUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Reconnect Facebook
              </a>
            )}
            {connection && disconnectControls}
          </div>
        ) : (
          <div className="space-y-3">
            {connectUrlLoading ? (
              <p className="text-sm text-muted-foreground">Preparing Facebook Connect…</p>
            ) : !isConfigured ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Facebook / Instagram Lead Ads isn&apos;t available for your account yet. Contact support to get this
                  connected.
                </p>
              </div>
            ) : (
              <a
                href={connectUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Connect with Facebook
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
