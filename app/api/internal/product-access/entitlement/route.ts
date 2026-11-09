import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import {
  applyFounderOverride,
  applyStripeSubscriptionToVenue,
  loadVenueEntitlementRow,
} from "@/lib/entitlement";
import {
  isVenueUuid,
  resolveVenueFromCandidates,
  type VenueResolution,
} from "@/lib/entitlement/resolve-venue";
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
 *
 * Venue resolution never uses purchaser email. Prefer venueId, then
 * saas_stripe_subscription_id, then an unambiguous saas_stripe_customer_id.
 * Ambiguous multi-venue matches fail closed for reconciliation.
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

function authorize(request: Request): boolean {
  const expected = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === expected);
}

async function resolveVenueForEntitlement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  input: {
    venueId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  },
): Promise<VenueResolution> {
  const explicit = input.venueId?.trim() || "";
  if (explicit && isVenueUuid(explicit)) {
    const { data } = await admin
      .from("venues")
      .select("id")
      .eq("id", explicit)
      .maybeSingle();
    if (data?.id) {
      return { ok: true, venueId: data.id as string, how: "venue_id" };
    }
  }

  const subscriptionId = input.stripeSubscriptionId?.trim() || "";
  let subscriptionMatches: string[] = [];
  if (subscriptionId) {
    const { data } = await admin
      .from("venues")
      .select("id")
      .eq("saas_stripe_subscription_id", subscriptionId);
    subscriptionMatches = ((data as { id: string }[] | null) ?? []).map(
      (row) => row.id,
    );
  }

  const customerId = input.stripeCustomerId?.trim() || "";
  let customerMatches: string[] = [];
  if (customerId) {
    const { data } = await admin
      .from("venues")
      .select("id")
      .eq("saas_stripe_customer_id", customerId);
    customerMatches = ((data as { id: string }[] | null) ?? []).map(
      (row) => row.id,
    );
  }

  // ownerEmail is intentionally ignored — multi-venue purchasers share email.
  return resolveVenueFromCandidates({
    explicitVenueId: null,
    subscriptionMatches,
    customerMatches,
  });
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
  const resolution = await resolveVenueForEntitlement(admin, {
    venueId: body.venueId,
    stripeCustomerId: body.stripeCustomerId,
    stripeSubscriptionId: body.stripeSubscriptionId,
  });

  if (!resolution.ok) {
    const recoverable = resolution.reason === "ambiguous";
    console.warn("[product-access/entitlement] venue resolution failed closed", {
      action,
      reason: resolution.reason,
      how: resolution.how,
      candidateIds: resolution.candidateIds,
      stripeSubscriptionId: body.stripeSubscriptionId ?? null,
      stripeCustomerId: body.stripeCustomerId ?? null,
      relationshipId: body.relationshipId ?? null,
      ownerEmailIgnored: Boolean(body.ownerEmail?.trim()),
      recoverable,
    });
    return NextResponse.json(
      {
        ok: false,
        applied: false,
        error:
          resolution.reason === "ambiguous"
            ? "Ambiguous venue resolution — reconciliation required"
            : "No matching product venue",
        detail: resolution.how,
        reason: resolution.reason,
        candidateIds: resolution.candidateIds,
        recoverable,
      },
      { status: resolution.reason === "ambiguous" ? 409 : 404 },
    );
  }

  const venueId = resolution.venueId;

  try {
    if (action === "get") {
      const row = await loadVenueEntitlementRow(venueId);
      return NextResponse.json({
        ok: true,
        venueId,
        resolvedHow: resolution.how,
        venue: row,
      });
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
      return NextResponse.json({ ...result, resolvedHow: resolution.how });
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
    return NextResponse.json({ ...result, resolvedHow: resolution.how });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[product-access/entitlement]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
