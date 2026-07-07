"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";
import { Clock, CreditCard, Loader2 } from "lucide-react";
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

/**
 * TR-M1 (Trust Risk Register): online payment collection is not actually
 * implemented — account-linking works, but nothing ever creates a real
 * charge. Per the "honestly absent, not misleading" principle, this card no
 * longer offers a "Connect with Stripe" action; it's a clear "coming soon"
 * state until real payment collection (a Stripe payment element + webhook-
 * confirmed charge status) ships. See docs/trust-risk-register.md TR-M1.
 */
export function StripeConnectSection({ venue }: { venue: Venue }) {
  const searchParams = useSearchParams();
  const stripeError = searchParams.get("stripe_error");
  const [disconnecting, startDisconnect] = React.useTransition();

  React.useEffect(() => {
    if (stripeError) toast.error(`Stripe error: ${stripeError}`);
  }, [stripeError]);

  const isConnected = venue.stripeOnboardingStatus === "connected";

  function handleDisconnect() {
    if (!confirm("Disconnect your Stripe account?")) return;
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
            Online Payment Collection
          </CardTitle>
          <Badge variant="muted">Coming soon</Badge>
        </div>
        <CardDescription>
          Accepting deposits and payments directly through Wevenu isn&apos;t live yet.
          Continue collecting payments the way you do today, and record them under
          Payments — your payment schedules and balances stay accurate either way.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-4">
              <Clock className="h-5 w-5 shrink-0 text-warning mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  A Stripe account is linked, but online charging isn&apos;t active.
                </p>
                {venue.stripeAccountId && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Account: {venue.stripeAccountId}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Linking your account doesn&apos;t process any payments today — no charge is ever created
                  through Wevenu yet. We&apos;ll let you know the moment real payment collection is ready.
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
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <Clock className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              We&apos;re building real online payment collection — a proper Stripe checkout your
              couples can pay through, with balances that update automatically. Until that ships,
              there&apos;s nothing to connect here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
