/**
 * Phase 5 founder arrangements — server-to-server (workspace CRM → venue-app).
 * Auth: Bearer PRODUCT_SYNC_API_KEY or CRON_SECRET.
 * Stripe Test mutations only.
 */

import { NextResponse } from "next/server";

import {
  createFounderArrangement,
  endFounderArrangement,
  extendFounderArrangement,
  formatUsdFromCents,
  getCatalogEntry,
  getPricingFounderV1Readiness,
  getPricingOfferStore,
  getTierUpgradeStore,
  isPricingFounderV1Ready,
  isSaasPlanKey,
  listAmountCents,
  previewArrangementForVenue,
  processFounderArrangementLifecycle,
  reconcileVenueFounderPricing,
  resolveLaunchCelebratePriceId,
  resolveLaunchFlourishPriceId,
  resolveLaunchGatherPriceId,
  resolveSaasProductId,
  selectWinningCommercialPrice,
  type EligibleGrant,
  type FounderArrangementDraft,
  type FounderArrangementKind,
  type SaasPlanKey,
  type StripeFounderExecutor,
} from "@shared/pricing";
import { getFounderArrangementStore } from "@shared/pricing/founder-store-access";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createSaasStripeClient } from "@/lib/billing/saas-stripe";
import { isSupabaseConfigured } from "@/lib/env";

function couponIdFromDiscount(disc: unknown): string | null {
  if (!disc || typeof disc === "string") return null;
  const row = disc as {
    coupon?: string | { id?: string } | null;
    source?: { coupon?: string | { id?: string } | null } | null;
  };
  const source = row.source?.coupon;
  if (typeof source === "string" && source) return source;
  if (source && typeof source === "object" && source.id) return source.id;
  const coupon = row.coupon;
  if (typeof coupon === "string" && coupon) return coupon;
  if (coupon && typeof coupon === "object" && coupon.id) return coupon.id;
  return null;
}

export const runtime = "nodejs";
export const maxDuration = 120;

function authorize(request: Request): boolean {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const productKey = process.env.PRODUCT_SYNC_API_KEY?.trim();
  const cronKey = process.env.CRON_SECRET?.trim();
  return Boolean(
    (productKey && token === productKey) || (cronKey && token === cronKey),
  );
}

function catalogPriceIdForPlan(planKey: SaasPlanKey): string | null {
  if (planKey === "starter") return resolveLaunchGatherPriceId();
  if (planKey === "growing") return resolveLaunchCelebratePriceId();
  return resolveLaunchFlourishPriceId();
}

async function loadVenueBillingContext(venueId: string) {
  const admin = createAdminClient();
  const { data: venue } = await admin
    .from("venues")
    .select(
      "id, name, saas_plan_key, saas_stripe_subscription_id, saas_stripe_customer_id, saas_subscription_status, current_period_end",
    )
    .eq("id", venueId)
    .maybeSingle();
  if (!venue) return null;

  const planKey = isSaasPlanKey(String(venue.saas_plan_key ?? ""))
    ? (venue.saas_plan_key as SaasPlanKey)
    : "starter";

  const offerStore = getPricingOfferStore();
  const grantsRaw = await offerStore.listEarnedGrantsForVenue(venueId);
  const grants: EligibleGrant[] = grantsRaw
    .filter((g) => g.status === "earned")
    .map((g) => ({
      id: g.id,
      offerType: g.offerType,
      percentOff: g.percentOff,
      status: g.status,
    }));

  let groupEligible = false;
  try {
    const { getGroupOrgStore } = await import(
      "@shared/pricing/group-org-store-access"
    );
    const orgStore = getGroupOrgStore();
    const membership = await orgStore.getActiveMembershipForVenue(venueId);
    if (membership) {
      const members = await orgStore.listMembershipsForOrg(
        membership.organizationId,
      );
      const venueIds = members.map((m) => m.venueId);
      const { data: memberVenues } = await admin
        .from("venues")
        .select("id, saas_subscription_status")
        .in("id", venueIds);
      const { evaluateGroupEligibility } = await import("@shared/pricing");
      const eligibility = evaluateGroupEligibility({
        members: members.map((m) => ({
          venueId: m.venueId,
          membershipStatus: m.status,
          subscriptionStatus:
            (memberVenues ?? []).find((v) => v.id === m.venueId)
              ?.saas_subscription_status ?? null,
        })),
        reservations: await orgStore.listReservationsForOrg(
          membership.organizationId,
        ),
      });
      groupEligible = eligibility.groupEligible;
    }
  } catch {
    groupEligible = false;
  }

  const tierStore = getTierUpgradeStore();
  const pending =
    (await tierStore.getActiveUpgradeForSubscription(
      String(venue.saas_stripe_subscription_id ?? ""),
    )) ?? null;
  const hold = await tierStore.getActiveHoldForVenue(venueId);

  let currentStripeCouponId: string | null = null;
  let currentStripePriceId: string | null = null;
  let nextInvoicePreviewCents: number | null = null;
  const subId = venue.saas_stripe_subscription_id as string | null;

  if (subId && resolveSaasProductId()) {
    try {
      const { stripe } = await createSaasStripeClient();
      const sub = await stripe.subscriptions.retrieve(subId, {
        expand: ["discounts", "items.data.price"],
      });
      currentStripeCouponId = couponIdFromDiscount(sub.discounts?.[0]);
      const price = sub.items.data[0]?.price;
      currentStripePriceId =
        typeof price === "string" ? price : price?.id ?? null;

      try {
        const upcoming = await stripe.invoices.createPreview({
          customer: String(venue.saas_stripe_customer_id ?? sub.customer),
          subscription: subId,
        });
        nextInvoicePreviewCents = upcoming.amount_due ?? null;
      } catch {
        nextInvoicePreviewCents = null;
      }
    } catch {
      // Stripe optional for read paths
    }
  }

  return {
    venue: {
      id: venue.id as string,
      name: (venue.name as string) || venueId,
      planKey,
      planName: getCatalogEntry(planKey).name,
      listAmountCents: listAmountCents(planKey),
      stripeSubscriptionId: subId,
      stripeCustomerId: (venue.saas_stripe_customer_id as string) || null,
      subscriptionStatus: (venue.saas_subscription_status as string) || null,
      currentPeriodEnd: (venue.current_period_end as string) || null,
    },
    grants,
    groupEligible,
    pendingTierUpgrade: pending,
    holdActive: Boolean(hold),
    hold,
    currentStripeCouponId,
    currentStripePriceId,
    nextInvoicePreviewCents,
  };
}

async function buildServiceContext() {
  const store = getFounderArrangementStore();
  let stripe: StripeFounderExecutor | null = null;
  try {
    stripe = (await createSaasStripeClient()).stripe as unknown as StripeFounderExecutor;
  } catch {
    stripe = null;
  }
  return {
    store,
    stripe,
    tierUpgradeStore: getTierUpgradeStore(),
    saasProductId: resolveSaasProductId(),
    catalogPriceIdForPlan,
  };
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const venueId = url.searchParams.get("venueId")?.trim();
  const readiness = getPricingFounderV1Readiness();

  if (!venueId) {
    // List venues with subscriptions for CRM picker
    const admin = createAdminClient();
    const { data: venues, error } = await admin
      .from("venues")
      .select(
        "id, name, saas_plan_key, saas_stripe_subscription_id, saas_subscription_status, current_period_end",
      )
      .not("saas_stripe_subscription_id", "is", null)
      .order("name", { ascending: true })
      .limit(200);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      readiness,
      venues: (venues ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        planKey: v.saas_plan_key,
        subscriptionId: v.saas_stripe_subscription_id,
        status: v.saas_subscription_status,
        currentPeriodEnd: v.current_period_end,
      })),
    });
  }

  const ctx = await loadVenueBillingContext(venueId);
  if (!ctx || !ctx.venue.stripeSubscriptionId) {
    return NextResponse.json({ error: "Venue or subscription not found" }, { status: 404 });
  }

  const store = getFounderArrangementStore();
  const arrangements = await store.listForVenue(venueId);
  const active = await store.listActiveOrScheduledForVenue(venueId);
  const selection = selectWinningCommercialPrice({
    planKey: ctx.venue.planKey,
    grants: ctx.grants,
    groupEligible: ctx.groupEligible,
    arrangements: active,
  });

  return NextResponse.json({
    ok: true,
    readiness,
    venue: {
      ...ctx.venue,
      listAmount: formatUsdFromCents(ctx.venue.listAmountCents),
      currentPeriodEnd: ctx.venue.currentPeriodEnd,
    },
    grants: ctx.grants.map((g) => ({
      id: g.id,
      offerType: g.offerType,
      percentOff: g.percentOff,
      // never expose internal notes
    })),
    groupEligible: ctx.groupEligible,
    holdActive: ctx.holdActive,
    pendingTierUpgrade: ctx.pendingTierUpgrade
      ? {
          id: ctx.pendingTierUpgrade.id,
          status: ctx.pendingTierUpgrade.status,
          requiredPlan: ctx.pendingTierUpgrade.requiredPlanKey,
          effectiveAt: ctx.pendingTierUpgrade.scheduledEffectiveAt,
        }
      : null,
    appliedOffer: {
      source: selection.winner.source,
      label: selection.winner.label,
      amountCents: selection.winner.expectedAmountCents,
      amount: formatUsdFromCents(selection.winner.expectedAmountCents),
    },
    nextInvoicePreviewCents: ctx.nextInvoicePreviewCents,
    nextInvoicePreview: ctx.nextInvoicePreviewCents != null
      ? formatUsdFromCents(ctx.nextInvoicePreviewCents)
      : null,
    nextInvoicePreviewSource:
      ctx.nextInvoicePreviewCents != null ? "stripe_test_preview" : null,
    arrangements: arrangements.map((a) => ({
      id: a.id,
      kind: a.kind,
      status: a.status,
      percentOff: a.percentOff,
      amountOffCents: a.amountOffCents,
      fixedRateCents: a.fixedRateCents,
      frozenListAmountCents: a.frozenListAmountCents,
      planScope: a.planScope,
      survivesTierChange: a.survivesTierChange,
      preventsTierUpgrade: a.preventsTierUpgrade,
      protectsBaseRate: a.protectsBaseRate,
      effectiveAt: a.effectiveAt,
      expiresAt: a.expiresAt,
      durationBillingCycles: a.durationBillingCycles,
      reason: a.reason,
      internalNotes: a.internalNotes,
      customerFacingLabel: a.customerFacingLabel,
      createdByEmail: a.createdByEmail,
      reconciliationStatus: a.reconciliationStatus,
      expectedRecurringAmountCents: a.expectedRecurringAmountCents,
      expectedRecurringAmount:
        a.expectedRecurringAmountCents != null
          ? formatUsdFromCents(a.expectedRecurringAmountCents)
          : null,
      lastReconcileError: a.lastReconcileError,
      lastReconciledAt: a.lastReconciledAt,
      stripeCouponId: a.stripeCouponId,
      stripePriceId: a.stripePriceId,
      audit: a.audit.slice(-20),
      createdAt: a.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    venueId?: string;
    arrangementId?: string;
    kind?: FounderArrangementKind;
    percentOff?: number;
    amountOffCents?: number;
    fixedRateCents?: number;
    frozenListAmountCents?: number;
    planScope?: FounderArrangementDraft["planScope"];
    survivesTierChange?: boolean;
    preventsTierUpgrade?: boolean;
    protectsBaseRate?: boolean;
    effectiveAt?: string;
    expiresAt?: string | null;
    durationBillingCycles?: number | null;
    reason?: string;
    internalNotes?: string | null;
    customerFacingLabel?: string | null;
    createdByEmail?: string;
    createdByUserId?: string | null;
    idempotencyKey?: string;
    confirmLargeDiscount?: boolean;
    newExpiresAt?: string | null;
    endReason?: string;
    actorEmail?: string;
    supersedesArrangementId?: string | null;
  };

  const action = body.action?.trim();
  const serviceCtx = await buildServiceContext();

  if (action === "process_lifecycle") {
    const result = await processFounderArrangementLifecycle(serviceCtx, {
      loadVenueContext: async (venueId) => {
        const ctx = await loadVenueBillingContext(venueId);
        if (!ctx?.venue.stripeSubscriptionId) return null;
        return {
          planKey: ctx.venue.planKey,
          grants: ctx.grants,
          groupEligible: ctx.groupEligible,
          pendingTierUpgrade: ctx.pendingTierUpgrade,
          currentStripeCouponId: ctx.currentStripeCouponId,
          currentStripePriceId: ctx.currentStripePriceId,
          stripeSubscriptionId: ctx.venue.stripeSubscriptionId,
        };
      },
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (!body.venueId?.trim()) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }
  const venueCtx = await loadVenueBillingContext(body.venueId.trim());
  if (!venueCtx?.venue.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "Venue subscription not found" },
      { status: 404 },
    );
  }

  if (action === "preview") {
    if (!body.kind || !body.effectiveAt || !body.reason?.trim()) {
      return NextResponse.json(
        { error: "kind, effectiveAt, and reason are required" },
        { status: 400 },
      );
    }
    const draft: FounderArrangementDraft = {
      venueId: body.venueId.trim(),
      stripeSubscriptionId: venueCtx.venue.stripeSubscriptionId,
      stripeCustomerId: venueCtx.venue.stripeCustomerId,
      kind: body.kind,
      percentOff: body.percentOff ?? null,
      amountOffCents: body.amountOffCents ?? null,
      fixedRateCents: body.fixedRateCents ?? null,
      frozenListAmountCents:
        body.frozenListAmountCents ??
        (body.kind === "rate_freeze"
          ? listAmountCents(venueCtx.venue.planKey)
          : null),
      planScope: body.planScope ?? "all",
      planKeyAtCreate: venueCtx.venue.planKey,
      survivesTierChange: body.survivesTierChange ?? true,
      preventsTierUpgrade:
        body.preventsTierUpgrade ?? body.kind === "tier_freeze",
      protectsBaseRate: body.protectsBaseRate ?? body.kind === "rate_freeze",
      effectiveAt: body.effectiveAt,
      expiresAt: body.expiresAt ?? null,
      durationBillingCycles: body.durationBillingCycles ?? null,
      reason: body.reason.trim(),
      internalNotes: body.internalNotes ?? null,
      customerFacingLabel: body.customerFacingLabel ?? null,
      createdByEmail: body.createdByEmail ?? null,
      createdByUserId: body.createdByUserId ?? null,
      idempotencyKey: body.idempotencyKey || `preview-${Date.now()}`,
      supersedesArrangementId: body.supersedesArrangementId ?? null,
    };
    const preview = await previewArrangementForVenue({
      ctx: serviceCtx,
      venueId: draft.venueId,
      draft,
      planKey: venueCtx.venue.planKey,
      grants: venueCtx.grants,
      groupEligible: venueCtx.groupEligible,
    });
    return NextResponse.json({
      ok: true,
      preview: {
        ...preview,
        currentAmount: formatUsdFromCents(preview.currentAmountCents),
        proposedAmount: formatUsdFromCents(preview.proposedAmountCents),
        difference: formatUsdFromCents(Math.abs(preview.differenceCents)),
        differenceSign: preview.differenceCents,
        calculationSource: "htc_estimate",
        note: "HTC estimate — not a guaranteed Stripe invoice until reconciled.",
      },
      readiness: getPricingFounderV1Readiness(),
    });
  }

  if (action === "create") {
    if (!isPricingFounderV1Ready()) {
      return NextResponse.json(
        {
          error: "Phase 5 not ready",
          readiness: getPricingFounderV1Readiness(),
        },
        { status: 503 },
      );
    }
    if (
      !body.kind ||
      !body.effectiveAt ||
      !body.reason?.trim() ||
      !body.idempotencyKey?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "kind, effectiveAt, reason, and idempotencyKey are required",
        },
        { status: 400 },
      );
    }

    const draft: FounderArrangementDraft = {
      venueId: body.venueId.trim(),
      stripeSubscriptionId: venueCtx.venue.stripeSubscriptionId,
      stripeCustomerId: venueCtx.venue.stripeCustomerId,
      kind: body.kind,
      percentOff: body.percentOff ?? null,
      amountOffCents: body.amountOffCents ?? null,
      fixedRateCents: body.fixedRateCents ?? null,
      frozenListAmountCents:
        body.frozenListAmountCents ??
        (body.kind === "rate_freeze"
          ? listAmountCents(venueCtx.venue.planKey)
          : null),
      planScope: body.planScope ?? "all",
      planKeyAtCreate: venueCtx.venue.planKey,
      survivesTierChange: body.survivesTierChange ?? true,
      preventsTierUpgrade:
        body.preventsTierUpgrade ?? body.kind === "tier_freeze",
      protectsBaseRate: body.protectsBaseRate ?? body.kind === "rate_freeze",
      effectiveAt: body.effectiveAt,
      expiresAt: body.expiresAt ?? null,
      durationBillingCycles: body.durationBillingCycles ?? null,
      reason: body.reason.trim(),
      internalNotes: body.internalNotes ?? null,
      customerFacingLabel: body.customerFacingLabel ?? null,
      createdByEmail: body.createdByEmail ?? body.actorEmail ?? null,
      createdByUserId: body.createdByUserId ?? null,
      idempotencyKey: body.idempotencyKey.trim(),
      supersedesArrangementId: body.supersedesArrangementId ?? null,
    };

    try {
      const result = await createFounderArrangement(serviceCtx, {
        draft,
        planKey: venueCtx.venue.planKey,
        grants: venueCtx.grants,
        groupEligible: venueCtx.groupEligible,
        pendingTierUpgrade: venueCtx.pendingTierUpgrade,
        currentStripeCouponId: venueCtx.currentStripeCouponId,
        currentStripePriceId: venueCtx.currentStripePriceId,
        confirmLargeDiscount: Boolean(body.confirmLargeDiscount),
      });
      return NextResponse.json({
        ok: true,
        arrangement: result.arrangement,
        preview: result.preview,
        stripeApplied: result.stripeApplied,
        deferredToSchedule: result.deferredToSchedule,
        warning: result.warning ?? null,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Create failed" },
        { status: 400 },
      );
    }
  }

  if (action === "end") {
    if (!body.arrangementId?.trim() || !body.endReason?.trim()) {
      return NextResponse.json(
        { error: "arrangementId and endReason required" },
        { status: 400 },
      );
    }
    try {
      const arrangement = await endFounderArrangement({
        ctx: serviceCtx,
        arrangementId: body.arrangementId.trim(),
        endedByEmail: body.actorEmail || body.createdByEmail || "founder",
        endReason: body.endReason.trim(),
        planKey: venueCtx.venue.planKey,
        grants: venueCtx.grants,
        groupEligible: venueCtx.groupEligible,
        pendingTierUpgrade: venueCtx.pendingTierUpgrade,
        currentStripeCouponId: venueCtx.currentStripeCouponId,
        currentStripePriceId: venueCtx.currentStripePriceId,
      });
      return NextResponse.json({ ok: true, arrangement });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "End failed" },
        { status: 400 },
      );
    }
  }

  if (action === "extend") {
    if (!body.arrangementId?.trim()) {
      return NextResponse.json(
        { error: "arrangementId required" },
        { status: 400 },
      );
    }
    try {
      const arrangement = await extendFounderArrangement({
        ctx: serviceCtx,
        arrangementId: body.arrangementId.trim(),
        newExpiresAt: body.newExpiresAt ?? null,
        durationBillingCycles: body.durationBillingCycles,
        actorEmail: body.actorEmail || "founder",
        reason: body.reason?.trim() || "Extended via Founder CRM",
      });
      return NextResponse.json({ ok: true, arrangement });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Extend failed" },
        { status: 400 },
      );
    }
  }

  if (action === "retry" || action === "reconcile") {
    const result = await reconcileVenueFounderPricing(serviceCtx, {
      venueId: body.venueId.trim(),
      planKey: venueCtx.venue.planKey,
      stripeSubscriptionId: venueCtx.venue.stripeSubscriptionId,
      grants: venueCtx.grants,
      groupEligible: venueCtx.groupEligible,
      pendingTierUpgrade: venueCtx.pendingTierUpgrade,
      currentStripeCouponId: venueCtx.currentStripeCouponId,
      currentStripePriceId: venueCtx.currentStripePriceId,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
