import { NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";

export const runtime = "nodejs";

/**
 * Open Stripe Customer Portal for SaaS subscription payment method update.
 * Used from /billing/suspended while the venue is hard-locked.
 *
 * Prefers venues.saas_stripe_customer_id (set on CRM Suspend). Falls back to
 * marketing portal proxy when MARKETING_SITE_URL is set and no local Stripe.
 */

export async function POST() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Authentication backend is not configured." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: venue, error } = await supabase
    .from("venues")
    .select("id, saas_stripe_customer_id, access_disabled")
    .maybeSingle<{
      id: string;
      saas_stripe_customer_id: string | null;
      access_disabled: boolean | null;
    }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!venue) {
    return NextResponse.json({ error: "No venue found for this account." }, { status: 404 });
  }

  const customerId = venue.saas_stripe_customer_id?.trim() || null;
  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "No billing customer is linked to this venue yet. Contact support and we will help restore access.",
      },
      { status: 400 },
    );
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
  ).replace(/\/$/, "");
  const returnUrl = `${appUrl}/billing/suspended`;

  // Prefer calling marketing portal when configured (same SaaS Stripe account).
  const marketingUrl = (
    process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
    process.env.MARKETING_SITE_URL?.trim() ||
    ""
  ).replace(/\/$/, "");

  if (marketingUrl) {
    try {
      const res = await fetch(`${marketingUrl}/api/stripe/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        return NextResponse.json({ url: data.url });
      }
      // Fall through to local Stripe if marketing portal fails.
      console.warn("[billing/portal] marketing portal failed", data.error || res.status);
    } catch (err) {
      console.warn("[billing/portal] marketing portal unreachable", err);
    }
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Billing portal is not configured. Set STRIPE_SECRET_KEY or NEXT_PUBLIC_MARKETING_URL.",
      },
      { status: 503 },
    );
  }

  try {
    const portal = await getStripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
