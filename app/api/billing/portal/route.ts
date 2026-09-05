import { NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Open Stripe Customer Portal for SaaS subscription payment method update.
 * Used from /billing/suspended while the venue is hard-locked.
 *
 * Uses venues.saas_stripe_customer_id (HTC subscription Stripe account) via
 * the marketing app's portal API — never the venue-app Connect Stripe client.
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

  // Never fall through to the venue-app Stripe client: that process is wired to
  // htc/*/stripe-connect (Connect platform), while saas_stripe_customer_id lives
  // on the separate HTC SaaS Stripe account (htc/*/stripe-saas → marketing).
  const marketingUrl = (
    process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
    process.env.MARKETING_SITE_URL?.trim() ||
    ""
  ).replace(/\/$/, "");

  if (!marketingUrl) {
    return NextResponse.json(
      {
        error:
          "Billing portal is not configured. Set NEXT_PUBLIC_MARKETING_URL so SaaS portal sessions use the Hello to Cheers subscription Stripe account.",
      },
      { status: 503 },
    );
  }

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
    console.warn("[billing/portal] marketing portal failed", data.error || res.status);
    return NextResponse.json(
      {
        error:
          data.error ??
          "Could not open the subscription billing portal. Try again or contact support.",
      },
      { status: res.ok ? 500 : res.status },
    );
  } catch (err) {
    console.warn("[billing/portal] marketing portal unreachable", err);
    return NextResponse.json(
      {
        error:
          "Subscription billing portal is temporarily unavailable. Try again or contact support.",
      },
      { status: 503 },
    );
  }
}
