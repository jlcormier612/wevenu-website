import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import {
  applyFounderOverride,
  applyStripeSubscriptionToVenue,
  loadVenueEntitlementRow,
} from "@/lib/entitlement";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Internal CRM / marketing → product entitlement sync & founder overrides.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY
 *
 * Actions:
 *   sync_stripe — apply Stripe subscription facts and re-evaluate access
 *   founder_override — access/retention/security controls (never mutates Stripe)
 *   get — read current entitlement snapshot
 */

type Body = {
  action?: "sync_stripe" | "founder_override" | "get";
  venueId?: string | null;
  ownerEmail?: string | null;
  relationshipId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  dunningStartedAt?: string | null;
  dunningClearedAt?: string | null;
  preferNonpaymentReason?: boolean;
  reason?: string | null;
  actorId?: string | null;
  actorLabel?: string | null;
  accessOverrideUntil?: string | null;
  clearOverride?: boolean;
  pauseBillingSuspend?: boolean;
  retentionHold?: boolean;
  retentionHoldReason?: string | null;
  manualSecurityLock?: boolean;
  manualSecurityLockReason?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === expected);
}

async function resolveVenueId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  venueId: string | null | undefined,
  ownerEmail: string | null | undefined,
  stripeCustomerId?: string | null,
): Promise<string | null> {
  if (venueId && UUID_RE.test(venueId.trim())) {
    const { data } = await admin
      .from("venues")
      .select("id")
      .eq("id", venueId.trim())
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (stripeCustomerId?.trim()) {
    const { data } = await admin
      .from("venues")
      .select("id")
      .eq("saas_stripe_customer_id", stripeCustomerId.trim())
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  const email = ownerEmail?.trim().toLowerCase();
  if (!email) return null;
  const { data: byVenueEmail } = await admin
    .from("venues")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (byVenueEmail?.id) return byVenueEmail.id as string;
  const { data: byStaff } = await admin
    .from("venue_staff")
    .select("venue_id")
    .ilike("email", email)
    .eq("is_owner", true)
    .limit(1)
    .maybeSingle();
  return (byStaff?.venue_id as string | undefined) ?? null;
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action ?? "sync_stripe";
  const admin = createAdminClient();
  const venueId = await resolveVenueId(
    admin,
    body.venueId,
    body.ownerEmail,
    body.stripeCustomerId,
  );
  if (!venueId) {
    return NextResponse.json(
      { ok: false, error: "No matching product venue" },
      { status: 404 },
    );
  }

  try {
    if (action === "get") {
      const row = await loadVenueEntitlementRow(venueId);
      return NextResponse.json({ ok: true, venueId, venue: row });
    }

    if (action === "founder_override") {
      if (!body.actorId?.trim() || !body.reason?.trim()) {
        return NextResponse.json(
          { error: "actorId and reason are required for founder_override" },
          { status: 400 },
        );
      }
      const result = await applyFounderOverride({
        venueId,
        relationshipId: body.relationshipId,
        actorId: body.actorId,
        actorLabel: body.actorLabel,
        reason: body.reason,
        accessOverrideUntil: body.accessOverrideUntil,
        clearOverride: body.clearOverride,
        pauseBillingSuspend: body.pauseBillingSuspend,
        retentionHold: body.retentionHold,
        retentionHoldReason: body.retentionHoldReason,
        manualSecurityLock: body.manualSecurityLock,
        manualSecurityLockReason: body.manualSecurityLockReason,
        dunningStartedAt: body.dunningStartedAt,
        dunningClearedAt: body.dunningClearedAt,
        reevaluate: true,
      });
      return NextResponse.json(result);
    }

    // sync_stripe
    if (!body.stripeStatus) {
      return NextResponse.json(
        { error: "stripeStatus is required for sync_stripe" },
        { status: 400 },
      );
    }
    const result = await applyStripeSubscriptionToVenue({
      venueId,
      stripeCustomerId: body.stripeCustomerId,
      stripeSubscriptionId: body.stripeSubscriptionId,
      stripeStatus: body.stripeStatus,
      cancelAtPeriodEnd: Boolean(body.cancelAtPeriodEnd),
      currentPeriodEnd: body.currentPeriodEnd ?? null,
      dunningStartedAt: body.dunningStartedAt,
      dunningClearedAt: body.dunningClearedAt,
      preferNonpaymentReason: Boolean(body.preferNonpaymentReason),
      relationshipId: body.relationshipId,
      actorId: body.actorId ?? "stripe_webhook",
      reason: body.reason,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[product-access/entitlement]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
