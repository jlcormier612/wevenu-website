import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Internal marketing/ -> product enrollment lookup, read-only.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Lets marketing/app/pricing/success read back the enrollment a
 * checkout.session.completed webhook just created, keyed by the same
 * stripe_checkout_session_id Stripe puts on the success redirect
 * (?session_id=...). Never returns a password or anything not already
 * destined for the customer (activation_token is the same value the
 * welcome email links to).
 *
 * Body: { stripeCheckoutSessionId }
 */
type LookupBody = {
  stripeCheckoutSessionId?: string;
};

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === expected);
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured in this environment." },
      { status: 503 },
    );
  }

  let body: LookupBody;
  try {
    body = (await request.json()) as LookupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.stripeCheckoutSessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "stripeCheckoutSessionId is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const { data: enrollment, error } = await admin
      .from("venue_enrollments")
      .select("venue_name, onboarding_type, status, activation_token")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (error) throw error;

    if (!enrollment) {
      return NextResponse.json({ ok: true, found: false });
    }

    return NextResponse.json({
      ok: true,
      found: true,
      venueName: enrollment.venue_name as string,
      onboardingType: enrollment.onboarding_type as string,
      status: enrollment.status as string,
      // Only present pre-activation for self_setup — matches the same
      // value the welcome email already sends; nothing more sensitive.
      activationToken: (enrollment.activation_token as string | null) ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[enrollment/by-session]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
