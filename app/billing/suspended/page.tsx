import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { UpdatePaymentMethodButton } from "@/components/billing/update-payment-method-button";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Subscription inactive",
};

const LIGHT_THEME_VARS = {
  "--background": "var(--true-white)",
  "--foreground": "var(--black)",
  "--card": "var(--true-white)",
  "--card-foreground": "var(--black)",
  "--popover": "var(--true-white)",
  "--popover-foreground": "var(--black)",
  "--heading": "var(--forest-sage)",
  "--muted-foreground": "color-mix(in oklch, var(--forest-sage) 70%, transparent)",
  "--border": "var(--taupe-light)",
  "--input": "var(--taupe-light)",
  "--ring": "var(--heritage-sage)",
} as CSSProperties;

export default async function BillingSuspendedPage() {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: venue } = await supabase
    .from("venues")
    .select("name, access_disabled, account_status, saas_stripe_customer_id")
    .maybeSingle<{
      name: string;
      access_disabled: boolean | null;
      account_status: string | null;
      saas_stripe_customer_id: string | null;
    }>();

  // If the venue is active again (e.g. payment succeeded), send them home.
  if (venue && venue.access_disabled !== true && venue.account_status !== "suspended") {
    redirect("/dashboard");
  }

  const venueLabel = venue?.name?.trim() || "your venue";
  const hasBillingCustomer = Boolean(venue?.saas_stripe_customer_id?.trim());

  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center px-4 py-12"
      style={{
        background: "color-mix(in oklch, var(--linen), var(--taupe-dark) 45%)",
        ...LIGHT_THEME_VARS,
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex justify-center">
          <Wordmark forceLight />
        </div>

        <Card>
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-xl text-heading">
              Subscription inactive
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Access to {venueLabel} is paused because the Hello to Cheers
              subscription is inactive. Your venue data is fully preserved —
              nothing has been deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Update your payment method to restore access. Once payment
              succeeds, you can sign back in and continue where you left off.
            </p>

            {hasBillingCustomer ? (
              <UpdatePaymentMethodButton />
            ) : (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
                Billing details are not linked yet. Contact support and we will
                help restore access without losing your data.
              </p>
            )}

            <form action={signOut}>
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Need help?{" "}
              <Link
                href="mailto:jennifer@hellotocheers.com"
                className="underline underline-offset-2"
              >
                Contact support
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
