"use client";

import * as React from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { FacebookConnection, FacebookLeadForm, FacebookLeadLogEntry } from "@/lib/facebook/types";
import { facebookUiState } from "@/lib/facebook/ui-state";
import { cn } from "@/lib/utils";

type Page = { id: string; name: string };
type Form = { id: string; name: string };

/**
 * Two-step connection picker.
 *
 * Facebook is deliberately NOT modelled as a binary integration like Stripe
 * Connect or QuickBooks: authorizing Meta grants nothing on its own, a Page
 * must be bound, and then at least one Lead Ads form must be enabled. Both
 * ingestion paths (app/api/facebook/webhook/route.ts and
 * lib/facebook/reconcile.ts) filter on an enabled facebook_lead_forms row, so
 * a Page-only connection delivers exactly zero leads. The steps are therefore
 * labelled and rendered as actions rather than status rows.
 *
 * `initialStep` lets an already-Paged venue re-enter at form selection without
 * being forced to re-pick (and re-subscribe) its Page.
 */
function PageFormPicker({
  initialStep,
  initialSelectedFormIds,
  onDone,
}: {
  initialStep: "page" | "form";
  initialSelectedFormIds: string[];
  onDone: () => void;
}) {
  const [step, setStep] = React.useState<"page" | "form">(initialStep);
  const [pages, setPages] = React.useState<Page[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [forms, setForms] = React.useState<Form[] | null>(null);
  const [formsError, setFormsError] = React.useState<string | null>(null);
  const [selectingPageId, setSelectingPageId] = React.useState<string | null>(null);
  // Pre-checked from what is already enabled: selectFacebookLeadForms replaces
  // the whole set, so starting empty would silently drop existing selections.
  const [selectedForms, setSelectedForms] = React.useState<Set<string>>(() => new Set(initialSelectedFormIds));
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (step !== "page") return;
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
  }, [step]);

  // Entering directly at step 2 (Page already bound) has to fetch the forms
  // itself — nothing has called listFacebookLeadForms on this mount path.
  React.useEffect(() => {
    if (initialStep !== "form" || forms !== null) return;
    let cancelled = false;
    listFacebookLeadFormsAction()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setForms(res.forms);
          setFormsError(null);
        } else {
          setForms([]);
          setFormsError(res.message);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setForms([]);
        setFormsError(err instanceof Error ? err.message : "Could not load Lead Ads forms.");
      });
    return () => {
      cancelled = true;
    };
  }, [initialStep, forms]);

  function choosePage(page: Page) {
    setSelectingPageId(page.id);
    startTransition(async () => {
      const result = await selectFacebookPageAction({ pageId: page.id });
      if (!result.ok) {
        toast.error(result.message ?? "Could not select this Page.");
        setSelectingPageId(null);
        return;
      }
      const formsResult = await listFacebookLeadFormsAction();
      setSelectingPageId(null);
      if (formsResult.ok) {
        setForms(formsResult.forms);
        setFormsError(null);
        setStep("form");
      } else {
        setForms([]);
        setFormsError(formsResult.message);
        setStep("form");
      }
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
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 of 2</p>
          <p className="text-sm font-medium text-heading">Select a Facebook Page</p>
          <p className="text-xs text-muted-foreground">
            Choose the Page whose Lead Ads should feed Hello to Cheers. Instagram Lead Ads run through this same
            Page — you don&apos;t connect Instagram separately.
          </p>
        </div>
        {!pages ? (
          <p className="text-xs text-muted-foreground">Loading your Facebook Pages…</p>
        ) : pages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {loadError ?? "No Pages found for this Facebook account."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {pages.map((p) => {
              const isSelecting = selectingPageId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePage(p)}
                  disabled={pending}
                  aria-busy={isSelecting}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    isSelecting ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted",
                    pending && !isSelecting && "opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      isSelecting ? "border-primary" : "border-muted-foreground/40",
                    )}
                  >
                    {isSelecting && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="flex-1 font-medium text-foreground">{p.name}</span>
                  {isSelecting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <span className="text-xs font-medium text-primary">Select</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const hasForms = !!forms && forms.length > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2 of 2</p>
        <p className="text-sm font-medium text-heading">Choose Lead Ads forms</p>
        <p className="text-xs text-muted-foreground">
          Only the forms you select here will send leads into Hello to Cheers.
        </p>
      </div>

      {!forms ? (
        <p className="text-xs text-muted-foreground">Loading Lead Ads forms…</p>
      ) : !hasForms ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              No Lead Ads forms were found for this Page yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Create a Lead Ad form in Meta, then return here to connect it. Setup is not complete until at least
              one form is connected.
            </p>
            {formsError && <p className="text-xs text-muted-foreground">{formsError}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {forms.map((f) => {
            const checked = selectedForms.has(f.id);
            return (
              <label
                key={f.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleForm(f.id)}
                  disabled={pending}
                  className="mt-0.5"
                />
                <span className="flex-1 font-medium text-foreground">{f.name}</span>
              </label>
            );
          })}
        </div>
      )}

      {hasForms && selectedForms.size === 0 && (
        <p className="text-xs text-warning">Select at least one form to finish — no leads arrive until you do.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={confirmForms} disabled={pending || selectedForms.size === 0}>
          {pending ? "Saving…" : "Connect selected forms"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setStep("page");
            setForms(null);
            setFormsError(null);
          }}
        >
          Change Page
        </Button>
      </div>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const fbSuccess = searchParams.get("facebook_success");
  const fbError = searchParams.get("facebook_error");
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [togglingFormId, setTogglingFormId] = React.useState<string | null>(null);

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

  // Derived in lib/facebook/ui-state.ts, which documents why the connection's
  // own status is not sufficient to claim the integration works.
  const uiState = facebookUiState(connection, leadForms);
  const isDisconnected = uiState === "not_connected";
  const needsPageSelection = uiState === "needs_page_selection";
  const needsForms = uiState === "needs_forms";
  const isDelivering = uiState === "delivering";
  const isError = uiState === "error";

  async function runDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/facebook/disconnect", { method: "POST" });
      const result = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !result?.ok) {
        toast.error(result?.message ?? "Could not disconnect Facebook.");
        setDisconnecting(false);
        setConfirmDisconnect(false);
        return;
      }
      toast.success("Facebook disconnected.");
      window.location.assign("/settings#facebook");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disconnect Facebook.");
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  }

  // Refreshed rather than fire-and-forget: disabling the last enabled form has
  // to move the card out of its "Connected" state, which is derived from
  // server-rendered leadForms.
  function toggleFormEnabled(formId: string, enabled: boolean) {
    setTogglingFormId(formId);
    void setFacebookFormEnabledAction(formId, enabled)
      .then((result) => {
        if (!result.ok) toast.error(result.message ?? "Could not update this form.");
        router.refresh();
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not update this form.");
      })
      .finally(() => setTogglingFormId(null));
  }

  function closePicker() {
    setShowPicker(false);
    router.refresh();
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

  const picker = (
    <PageFormPicker
      initialStep={connection?.pageId ? "form" : "page"}
      initialSelectedFormIds={leadForms.filter((f) => f.isEnabled).map((f) => f.formId)}
      onDone={closePicker}
    />
  );

  const recentActivity = recentLog.length > 0 && (
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
  );

  function renderBody() {
    if (isError) {
      return (
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
      );
    }

    if (isDisconnected) {
      return (
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
            <>
              <p className="text-xs text-muted-foreground">
                Connecting takes two steps after Facebook: choose your Page, then choose which Lead Ads forms feed
                Hello to Cheers.
              </p>
              <a
                href={connectUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Connect with Facebook
              </a>
            </>
          )}
        </div>
      );
    }

    if (showPicker || needsPageSelection) {
      return (
        <div className="space-y-4">
          {needsPageSelection && connection?.lastError ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">This Page is not subscribed to lead notifications yet.</p>
                <p className="text-xs text-muted-foreground">{connection.lastError}</p>
              </div>
            </div>
          ) : null}
          {picker}
          <div className="border-t border-border pt-3">{disconnectControls}</div>
        </div>
      );
    }

    if (needsForms) {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                Your Facebook Page is connected, but no Lead Ads forms are connected yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Leads will not arrive until you choose at least one form.
                {connection?.pageName ? ` Page: ${connection.pageName}.` : ""}
              </p>
            </div>
          </div>
          {leadForms.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Connected forms — all currently turned off
              </p>
              {leadForms.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  {f.formName ?? f.formId}
                  <Switch
                    checked={f.isEnabled}
                    disabled={togglingFormId === f.formId}
                    onCheckedChange={(v) => toggleFormEnabled(f.formId, v)}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setShowPicker(true)}>
              Choose Lead Ads forms
            </Button>
            {disconnectControls}
          </div>
          {recentActivity}
        </div>
      );
    }

    // isDelivering
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Connected to {connection?.pageName}.</p>
            <p className="text-xs text-muted-foreground">
              Your connected Lead Ads forms will sync new leads automatically.
            </p>
          </div>
        </div>
        {leadForms.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Connected forms</p>
            {leadForms.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                {f.formName ?? f.formId}
                <Switch
                  checked={f.isEnabled}
                  disabled={togglingFormId === f.formId}
                  onCheckedChange={(v) => toggleFormEnabled(f.formId, v)}
                />
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
        {recentActivity}
      </div>
    );
  }

  return (
    <Card id="facebook" className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            Facebook / Instagram Lead Ads
          </CardTitle>
          {isDelivering && <Badge variant="success">Connected</Badge>}
          {needsForms && <Badge variant="warning">Action needed</Badge>}
          {needsPageSelection && <Badge variant="warning">Action needed</Badge>}
          {isError && <Badge variant="destructive">Reconnect required</Badge>}
          {isDisconnected && <Badge variant="muted">Not connected</Badge>}
        </div>
        <CardDescription>
          Every lead submitted through your connected Lead Ads forms becomes a Lead in Hello to Cheers automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{renderBody()}</CardContent>
    </Card>
  );
}
