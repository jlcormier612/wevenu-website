"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { disconnectStripeAction, updateAcceptedPaymentMethodsAction } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StripePaymentMethodType, Venue } from "@/lib/venue/types";

/**
 * Sprint 4 — Venue Payment Processing. Mirrors buildQuickBooksConnectUrl(),
 * including the `returnTo` addition (Guided Setup §1.2, 2026-07-22) — the
 * "payments" wizard step embeds this same component, and without a
 * returnTo the callback always sent the browser to /settings, stranding
 * anyone connecting from onboarding instead of returning them to the
 * wizard step they were on.
 */
export function buildStripeConnectUrl(venueId: string, returnTo: "settings" | "onboarding" = "settings"): string | null {
  const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "read_write",
    redirect_uri: `${appUrl}/api/stripe/callback`,
    state: `${venueId}:${returnTo}`, // CSRF: the venueId half is verified against the session's actual venue in the callback
  });

  return `https://connect.stripe.com/oauth/authorize?${params}`;
}

const PAYMENT_METHOD_OPTIONS: { value: StripePaymentMethodType; label: string; hint: string }[] = [
  { value: "card", label: "Credit/Debit Card", hint: "Confirms instantly." },
  { value: "us_bank_account", label: "ACH Bank Transfer", hint: "Lower processing fees; takes 4–5 business days to settle." },
];

export function StripeConnectSection({ venue, returnTo = "settings" }: { venue: Venue; returnTo?: "settings" | "onboarding" }) {
  const searchParams = useSearchParams();
  const stripeSuccess = searchParams.get("stripe_success");
  const stripeError = searchParams.get("stripe_error");
  const [disconnecting, startDisconnect] = React.useTransition();
  const [savingMethods, startSaveMethods] = React.useTransition();
  const [methods, setMethods] = React.useState<StripePaymentMethodType[]>(venue.stripeAcceptedPaymentMethods);

  React.useEffect(() => {
    if (stripeSuccess) toast.success("Stripe connected successfully.");
    if (stripeError) toast.error(`Stripe error: ${stripeError}`);
  }, [stripeSuccess, stripeError]);

  const connectUrl = buildStripeConnectUrl(venue.id, returnTo);
  const isConfigured = !!connectUrl;
  const isConnected = venue.stripeOnboardingStatus === "connected";
  const chargesEnabled = isConnected && venue.stripeChargesEnabled;

  function handleDisconnect() {
    if (!confirm("Disconnect your Stripe account? Couples will no longer be able to pay online until you reconnect.")) return;
    startDisconnect(async () => {
      const result = await disconnectStripeAction();
      if (result.ok) toast.success("Stripe account disconnected.");
      else toast.error(result.message ?? "Could not disconnect Stripe.");
    });
  }

  function toggleMethod(value: StripePaymentMethodType, checked: boolean) {
    const next = checked ? [...methods, value] : methods.filter((m) => m !== value);
    if (next.length === 0) { toast.error("Select at least one payment method."); return; }
    setMethods(next);
    startSaveMethods(async () => {
      const result = await updateAcceptedPaymentMethodsAction(next);
      if (!result.ok) { toast.error(result.message ?? "Could not save payment methods."); setMethods(methods); }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Online Payment Collection
          </CardTitle>
          {isConnected && chargesEnabled && <Badge variant="success">Connected</Badge>}
          {isConnected && !chargesEnabled && <Badge variant="warning">Connected, setup incomplete</Badge>}
          {!isConnected && <Badge variant="muted">Not connected</Badge>}
        </div>
        <CardDescription>
          Connect your own Stripe account so couples can pay deposits and invoices directly —
          money goes straight to your bank account. Hello to Cheers never holds or touches your funds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-4">
            {chargesEnabled ? (
              <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/5 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Your Stripe account is connected and ready to accept payments.</p>
                  {venue.stripeAccountId && (
                    <p className="text-xs text-muted-foreground font-mono">Account: {venue.stripeAccountId}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">A Stripe account is linked, but it can&apos;t accept charges yet.</p>
                  <p className="text-xs text-muted-foreground">
                    Finish your account setup in Stripe (identity verification, bank details) — Hello to Cheers will pick it up automatically.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accepted payment methods</p>
              <div className="space-y-2">
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
                    <Checkbox
                      checked={methods.includes(opt.value)}
                      onCheckedChange={(v) => toggleMethod(opt.value, v === true)}
                      disabled={savingMethods}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-foreground">{opt.label}</span>
                      <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
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
                "Disconnect Stripe"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {!isConfigured ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  To enable online payments, add{" "}
                  <code className="text-xs bg-muted rounded px-1 py-0.5">NEXT_PUBLIC_STRIPE_CLIENT_ID</code>
                  {" "}and{" "}
                  <code className="text-xs bg-muted rounded px-1 py-0.5">STRIPE_SECRET_KEY</code>
                  {" "}to your environment variables.
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {[
                    "Couples pay deposits and invoices directly, by card or bank transfer",
                    "Balances update automatically the moment a payment lands",
                    "Money goes straight to your own Stripe account and bank — Hello to Cheers never touches it",
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
                  Connect with Stripe
                </a>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
