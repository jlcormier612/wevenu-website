import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Internal CRM (marketing/) → product enrollment upsert.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Idempotent on stripe_checkout_session_id. A token that already belongs to
 * another enrollment is refused. purchaseHold persists the session with
 * venue_id and activation_token left null.
 *
 * Welcome email: claim / record / release are separate from identity upsert.
 * recordWelcomeEmailSent runs only after the transport reports delivery.
 */

const WELCOME_CLAIM_TTL_MS = 10 * 60 * 1000;

type UpsertBody = {
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  venueName?: string;
  ownerEmail?: string;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  plan?: string | null;
  onboardingType?: string;
  activationToken?: string | null;
  purchaseHold?: boolean;
  recordWelcomeEmailSent?: boolean;
  claimWelcomeEmail?: boolean;
  releaseWelcomeEmailClaim?: boolean;
};

type EnrollmentIdentity = {
  id: string;
  status: string;
  activation_token: string | null;
  purchase_hold: boolean | null;
  welcome_email_sent_at: string | null;
  welcome_email_claimed_at: string | null;
  venue_id: string | null;
  stripe_checkout_session_id: string | null;
};

const IDENTITY_COLUMNS =
  "id, status, activation_token, purchase_hold, welcome_email_sent_at, welcome_email_claimed_at, venue_id, stripe_checkout_session_id";

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === expected);
}

function identityJson(row: EnrollmentIdentity, extra?: { claimed?: boolean }) {
  return {
    ok: true as const,
    id: row.id,
    status: row.status,
    welcomeEmailSentAt: row.welcome_email_sent_at,
    welcomeEmailClaimedAt: row.welcome_email_claimed_at,
    purchaseHold: Boolean(row.purchase_hold),
    venueId: row.venue_id,
    activationToken: row.activation_token,
    ...extra,
  };
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

  const admin = createAdminClient();
  const sessionId = body.stripeCheckoutSessionId?.trim() || null;

  if (body.recordWelcomeEmailSent || body.claimWelcomeEmail || body.releaseWelcomeEmailClaim) {
    if (!sessionId) {
      return NextResponse.json(
        { error: "stripeCheckoutSessionId is required" },
        { status: 400 },
      );
    }
    try {
      if (body.recordWelcomeEmailSent) {
        const sentAt = new Date().toISOString();
        const { data: marked, error } = await admin
          .from("venue_enrollments")
          .update({ welcome_email_sent_at: sentAt, welcome_email_claimed_at: null })
          .eq("stripe_checkout_session_id", sessionId)
          .is("welcome_email_sent_at", null)
          .select(IDENTITY_COLUMNS)
          .maybeSingle<EnrollmentIdentity>();
        if (error) throw error;
        if (marked) return NextResponse.json(identityJson(marked));
        const { data: existing, error: readErr } = await admin
          .from("venue_enrollments")
          .select(IDENTITY_COLUMNS)
          .eq("stripe_checkout_session_id", sessionId)
          .maybeSingle<EnrollmentIdentity>();
        if (readErr) throw readErr;
        if (!existing) {
          return NextResponse.json({ ok: false, error: "enrollment_not_found" }, { status: 404 });
        }
        return NextResponse.json(identityJson(existing));
      }

      if (body.releaseWelcomeEmailClaim) {
        const { error } = await admin
          .from("venue_enrollments")
          .update({ welcome_email_claimed_at: null })
          .eq("stripe_checkout_session_id", sessionId)
          .is("welcome_email_sent_at", null);
        if (error) throw error;
        const { data: existing, error: readErr } = await admin
          .from("venue_enrollments")
          .select(IDENTITY_COLUMNS)
          .eq("stripe_checkout_session_id", sessionId)
          .maybeSingle<EnrollmentIdentity>();
        if (readErr) throw readErr;
        if (!existing) {
          return NextResponse.json({ ok: false, error: "enrollment_not_found" }, { status: 404 });
        }
        return NextResponse.json(identityJson(existing, { claimed: false }));
      }

      const staleBefore = new Date(Date.now() - WELCOME_CLAIM_TTL_MS).toISOString();
      const { data: claimed, error } = await admin
        .from("venue_enrollments")
        .update({ welcome_email_claimed_at: new Date().toISOString() })
        .eq("stripe_checkout_session_id", sessionId)
        .is("welcome_email_sent_at", null)
        .or(
          `welcome_email_claimed_at.is.null,welcome_email_claimed_at.lt."${staleBefore}"`,
        )
        .select(IDENTITY_COLUMNS)
        .maybeSingle<EnrollmentIdentity>();
      if (error) throw error;
      if (claimed) return NextResponse.json(identityJson(claimed, { claimed: true }));
      const { data: existing, error: readErr } = await admin
        .from("venue_enrollments")
        .select(IDENTITY_COLUMNS)
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle<EnrollmentIdentity>();
      if (readErr) throw readErr;
      if (!existing) {
        return NextResponse.json({ ok: false, error: "enrollment_not_found" }, { status: 404 });
      }
      return NextResponse.json(identityJson(existing, { claimed: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[enrollment/upsert] welcome marker", message);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
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

  try {
    const patch: Record<string, unknown> = {
      stripe_customer_id: body.stripeCustomerId?.trim() || null,
      stripe_subscription_id: body.stripeSubscriptionId?.trim() || null,
      venue_name: venueName,
      owner_email: ownerEmail,
      owner_first_name: body.ownerFirstName?.trim() || null,
      owner_last_name: body.ownerLastName?.trim() || null,
      plan: body.plan?.trim() || null,
      onboarding_type: onboardingType,
    };
    if (sessionId) patch.stripe_checkout_session_id = sessionId;
    if (body.purchaseHold) {
      patch.purchase_hold = true;
      patch.activation_token = null;
      patch.activation_token_created_at = null;
    }

    let row: EnrollmentIdentity | null = null;

    if (sessionId) {
      const { data: existing, error: findErr } = await admin
        .from("venue_enrollments")
        .select(IDENTITY_COLUMNS)
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle<EnrollmentIdentity>();
      if (findErr) throw findErr;

      if (existing) {
        if (existing.status === "activated") {
          return NextResponse.json(identityJson(existing));
        }
        const tokenError = await tokenPatch(admin, body, existing, patch);
        if (tokenError) return tokenError;
        const { data: updated, error: updErr } = await admin
          .from("venue_enrollments")
          .update(patch)
          .eq("id", existing.id)
          .select(IDENTITY_COLUMNS)
          .single<EnrollmentIdentity>();
        if (updErr) throw updErr;
        row = updated;
      }
    }

    if (!row && body.stripeSubscriptionId?.trim() && !body.purchaseHold) {
      const subId = body.stripeSubscriptionId.trim();
      const { data: existingSub, error: findSubErr } = await admin
        .from("venue_enrollments")
        .select(IDENTITY_COLUMNS)
        .eq("stripe_subscription_id", subId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<EnrollmentIdentity>();
      if (findSubErr) throw findSubErr;
      if (existingSub) {
        if (
          existingSub.stripe_checkout_session_id &&
          sessionId &&
          existingSub.stripe_checkout_session_id !== sessionId
        ) {
          // Session B is a different checkout. Do not return enrollment A.
          // Fall through to insert session B.
        } else if (existingSub.status === "activated") {
          return NextResponse.json(identityJson(existingSub));
        } else {
          const tokenError = await tokenPatch(admin, body, existingSub, patch);
          if (tokenError) return tokenError;
          const { data: updated, error: updErr } = await admin
            .from("venue_enrollments")
            .update(patch)
            .eq("id", existingSub.id)
            .select(IDENTITY_COLUMNS)
            .single<EnrollmentIdentity>();
          if (updErr) throw updErr;
          row = updated;
        }
      }
    }

    if (!row) {
      const tokenError = await tokenPatch(admin, body, null, patch);
      if (tokenError) return tokenError;
      const { data: inserted, error: insErr } = await admin
        .from("venue_enrollments")
        .insert(patch)
        .select(IDENTITY_COLUMNS)
        .single<EnrollmentIdentity>();
      if (insErr) throw insErr;
      row = inserted;
    }

    return NextResponse.json(identityJson(row));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[enrollment/upsert]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function tokenPatch(
  admin: ReturnType<typeof createAdminClient>,
  body: UpsertBody,
  existing: EnrollmentIdentity | null,
  patch: Record<string, unknown>,
): Promise<Response | null> {
  if (body.purchaseHold || existing?.purchase_hold) {
    delete patch.activation_token;
    delete patch.activation_token_created_at;
    if (body.purchaseHold) {
      patch.purchase_hold = true;
    }
    return null;
  }
  const incoming = body.activationToken?.trim() || "";
  if (!incoming) return null;
  if (existing?.activation_token && existing.activation_token !== incoming) {
    return NextResponse.json(
      { ok: false, error: "activation_token_mismatch" },
      { status: 409 },
    );
  }
  const { data: owner, error } = await admin
    .from("venue_enrollments")
    .select("id")
    .eq("activation_token", incoming)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (owner && owner.id !== existing?.id) {
    return NextResponse.json(
      { ok: false, error: "activation_token_belongs_to_another_enrollment" },
      { status: 409 },
    );
  }
  if (!existing?.activation_token) {
    patch.activation_token = incoming;
    patch.activation_token_created_at = new Date().toISOString();
  }
  return null;
}
