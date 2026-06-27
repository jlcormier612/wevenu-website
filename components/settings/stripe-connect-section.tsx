"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { disconnectStripeAction } from "@/app/(app)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Venue } from "@/lib/venue/types";

/** Build the Stripe Connect authorization URL. */
function buildStripeConnectUrl(venueId: string): string | null {
  const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!clientId) return null;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: `${appUrl}/api/stripe/callback`,
    state: venueId, // CSRF: verified against the session's venue in the callback
  });

  return `https://connect.stripe.com/oauth/authorize?${params}`;
}

export function StripeConnectSection({ venue }: { venue: Venue }) {
  const searchParams = useSearchParams();
  const stripeSuccess = searchParams.get("stripe_success");
  const stripeError = searchParams.get("stripe_error");
  const [disconnecting, startDisconnect] = React.useTransition();

  // Surface success / error toasts from the OAuth callback redirect
  React.useEffect(() => {
    if (stripeSuccess) toast.success("Stripe account connected successfully.");
    if (stripeError) toast.error(`Stripe error: ${stripeError}`);
  }, [stripeSuccess, stripeError]);

  const connectUrl = buildStripeConnectUrl(venue.id);
  const isConnected = venue.stripeOnboardingStatus === "connected";
  const isConfigured = !!connectUrl;

  function handleDisconnect() {
    if (!confirm("Disconnect your Stripe account? This will disable online payment collection.")) return;
    startDisconnect(async () => {
      await disconnectStripeAction();
      toast.success("Stripe account disconnected.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Stripe Connect
          </CardTitle>
          {isConnected && <Badge variant="success">Connected</Badge>}
          {!isConnected && <Badge variant="muted">Not Connected</Badge>}
        </div>
        <CardDescription>
          Connect your Stripe account to accept deposits and payments directly
          through Wevenu — no separate invoicing tool required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/5 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  Stripe is connected and active.
                </p>
                {venue.stripeAccountId && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Account: {venue.stripeAccountId}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Payment schedule line items can now be collected online.
                </p>
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
                  To enable Stripe, add{" "}
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
                    "Accept deposits and installments through payment links",
                    "Payments reconcile automatically with your payment schedules",
                    "No platform fee — standard Stripe processing rates apply",
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
