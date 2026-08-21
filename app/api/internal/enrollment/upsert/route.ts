import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Internal CRM (marketing/) → product enrollment upsert.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Called from marketing/'s Stripe `checkout.session.completed` handler in
 * place of the local JSON-file enrollment write. Idempotent on
 * stripeCheckoutSessionId — a webhook retry must not create a second row.
 *
 * Does not create the venue or the owner account — that happens later, at
 * activation (see /api/internal/enrollment/activate). This endpoint only
 * durably records that an enrollment exists and stores the activation
 * token the caller already generated (token generation itself is
 * unchanged — see docs/postgres-auth-architecture-findings.md §6).
 *
 * Body:
 *   {
 *     stripeCheckoutSessionId, stripeCustomerId?, stripeSubscriptionId?,
 *     venueName, ownerEmail, plan?, onboardingType: "self_setup"|"white_glove",
 *     activationToken?  // absent for white_glove — matches existing behavior
 *   }
 */
type UpsertBody = {
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  venueName?: string;
  ownerEmail?: string;
  plan?: string | null;
  onboardingType?: string;
  activationToken?: string | null;
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

  let body: UpsertBody;
  try {
    body = (await request.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const venueName = body.venueName?.trim();
  const ownerEmail = body.ownerEmail?.trim().toLowerCase();
  const onboardingType = body.onboardingType === "white_glove" ? "white_glove" : "self_setup";

  if (!venueName || !ownerEmail) {
    return NextResponse.json(
      { error: "venueName and ownerEmail are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const sessionId = body.stripeCheckoutSessionId?.trim() || null;

  try {
    const patch: Record<string, unknown> = {
      stripe_checkout_session_id: sessionId,
      stripe_customer_id: body.stripeCustomerId?.trim() || null,
      stripe_subscription_id: body.stripeSubscriptionId?.trim() || null,
      venue_name: venueName,
      owner_email: ownerEmail,
      plan: body.plan?.trim() || null,
      onboarding_type: onboardingType,
    };
    if (body.activationToken?.trim()) {
      patch.activation_token = body.activationToken.trim();
      patch.activation_token_created_at = new Date().toISOString();
    }

    // Idempotent on stripe_checkout_session_id when present (webhook
    // retries). Without a session id (shouldn't happen from the real
    // webhook, but defensive), fall back to a plain insert.
    let row: { id: string; status: string } | null = null;

    if (sessionId) {
      const { data: existing, error: findErr } = await admin
        .from("venue_enrollments")
        .select("id, status")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing) {
        // Already recorded (webhook retry) — don't overwrite an
        // already-activated row's identity fields, just acknowledge it.
        if (existing.status === "activated") {
          return NextResponse.json({ ok: true, id: existing.id, status: existing.status });
        }
        const { data: updated, error: updErr } = await admin
          .from("venue_enrollments")
          .update(patch)
          .eq("id", existing.id)
          .select("id, status")
          .single();
        if (updErr) throw updErr;
        row = updated;
      }
    }

    // White Glove Launch Workspace may re-upsert by subscription when the
    // checkout session id is missing on the Relationship but Stripe sub id exists.
    if (!row && body.stripeSubscriptionId?.trim()) {
      const subId = body.stripeSubscriptionId.trim();
      const { data: existingSub, error: findSubErr } = await admin
        .from("venue_enrollments")
        .select("id, status")
        .eq("stripe_subscription_id", subId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findSubErr) throw findSubErr;
      if (existingSub) {
        if (existingSub.status === "activated") {
          return NextResponse.json({
            ok: true,
            id: existingSub.id,
            status: existingSub.status,
          });
        }
        const { data: updated, error: updErr } = await admin
          .from("venue_enrollments")
          .update(patch)
          .eq("id", existingSub.id)
          .select("id, status")
          .single();
        if (updErr) throw updErr;
        row = updated;
      }
    }

    if (!row) {
      const { data: inserted, error: insErr } = await admin
        .from("venue_enrollments")
        .insert(patch)
        .select("id, status")
        .single();
      if (insErr) throw insErr;
      row = inserted;
    }

    return NextResponse.json({ ok: true, id: row.id, status: row.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[enrollment/upsert]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
