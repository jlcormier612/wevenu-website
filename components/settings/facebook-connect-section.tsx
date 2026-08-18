"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  disconnectFacebookAction,
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

function buildFacebookConnectUrl(venueId: string): string | null {
  const clientId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: `${appUrl}/api/facebook/callback`,
    scope: "pages_show_list,pages_manage_metadata,leads_retrieval,pages_read_engagement",
    state: venueId,
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

type Page = { id: string; name: string; accessToken: string };
type Form = { id: string; name: string };

function PageFormPicker({ onDone }: { onDone: () => void }) {
  const [step, setStep] = React.useState<"page" | "form">("page");
  const [pages, setPages] = React.useState<Page[] | null>(null);
  const [forms, setForms] = React.useState<Form[] | null>(null);
  const [selectedForms, setSelectedForms] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    listFacebookPagesAction().then((res) => {
      if (res.ok) setPages(res.pages);
      else toast.error(res.message);
    });
  }, []);

  function choosePage(page: Page) {
    startTransition(async () => {
      const result = await selectFacebookPageAction({ pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken });
      if (!result.ok) { toast.error(result.message ?? "Could not select this Page."); return; }
      const formsResult = await listFacebookLeadFormsAction();
      if (formsResult.ok) { setForms(formsResult.forms); setStep("form"); }
      else toast.error(formsResult.message);
    });
  }

  function toggleForm(id: string) {
    setSelectedForms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function confirmForms() {
    startTransition(async () => {
      const chosen = (forms ?? []).filter((f) => selectedForms.has(f.id)).map((f) => ({ formId: f.id, formName: f.name }));
      const result = await selectFacebookLeadFormsAction(chosen);
      if (result.ok) { toast.success("Facebook Lead Ads connected."); onDone(); }
      else toast.error(result.message ?? "Could not save selected forms.");
    });
  }

  if (step === "page") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-heading">Select a Page</p>
        {!pages ? (
          <p className="text-xs text-muted-foreground">Loading your Facebook Pages…</p>
        ) : pages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No Pages found for this Facebook account.</p>
        ) : (
          <div className="space-y-1.5">
            {pages.map((p) => (
              <button
                key={p.id} type="button" onClick={() => choosePage(p)} disabled={pending}
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
  venueId, connection, leadForms, recentLog,
}: {
  venueId: string;
  connection: FacebookConnection | null;
  leadForms: FacebookLeadForm[];
  recentLog: FacebookLeadLogEntry[];
}) {
  const searchParams = useSearchParams();
  const fbSuccess = searchParams.get("facebook_success");
  const fbError = searchParams.get("facebook_error");
  const [disconnecting, startDisconnect] = React.useTransition();
  const [showPicker, setShowPicker] = React.useState(false);

  React.useEffect(() => {
    if (fbSuccess) toast.success("Facebook connected — now select a Page.");
    if (fbError) toast.error(`Facebook error: ${fbError}`);
  }, [fbSuccess, fbError]);

  // Client-side OAuth exchange isn't possible for Meta from a plain link
  // (unlike Stripe/QuickBooks's authorization-code flow, which is fine as
  // a plain <a>) — Meta's dialog also uses a redirect-based authorization
  // code flow, so the same plain-link pattern applies here.
  const connectUrl = buildFacebookConnectUrl(venueId);
  const isConfigured = !!connectUrl;
  const needsPageSelection = connection?.status === "needs_page_selection";
  const isConnected = connection?.status === "connected";
  const isError = connection?.status === "error";

  function handleDisconnect() {
    if (!confirm("Disconnect Facebook Lead Ads? New leads from your ad forms will stop importing until you reconnect.")) return;
    startDisconnect(async () => {
      const result = await disconnectFacebookAction();
      if (result.ok) toast.success("Facebook disconnected.");
      else toast.error(result.message ?? "Could not disconnect Facebook.");
    });
  }

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
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPicker(true)}>Manage connected forms</Button>
                  <Button type="button" variant="outline" size="sm" className="text-muted-foreground" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Disconnecting…</> : "Disconnect Facebook"}
                  </Button>
                </div>
                {recentLog.length > 0 && (
                  <div className="space-y-1.5 rounded-lg border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Recent activity</p>
                    <ul className="space-y-1">
                      {recentLog.slice(0, 10).map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between text-xs">
                          <span>
                            <Badge variant={entry.outcome === "succeeded" ? "success" : entry.outcome === "dead_lettered" ? "destructive" : "warning"}>
                              {entry.outcome === "succeeded" ? "Imported" : entry.outcome === "dead_lettered" ? "Failed" : "Retrying"}
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
              <PageFormPicker onDone={() => setShowPicker(false)} />
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
              <a href={connectUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                <ExternalLink className="h-3.5 w-3.5" /> Reconnect Facebook
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {!isConfigured ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Facebook / Instagram Lead Ads isn&apos;t available for your account yet. Contact support to get this connected.
                </p>
              </div>
            ) : (
              <a href={connectUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                <ExternalLink className="h-3.5 w-3.5" /> Connect with Facebook
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
