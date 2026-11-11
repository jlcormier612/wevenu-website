import { NextResponse } from "next/server";

import {
  applyScheduleForUpgrade,
  evaluateVenueTierUpgrade,
  getPricingOfferStore,
  getTierUpgradeStore,
  resolveSaasStripeSecretKey,
  sendNoticeForUpgrade,
  type EventVolumeRow,
  type VenueTierUpgradeSource,
} from "@shared/pricing";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createSaasStripeClient } from "@/lib/billing/saas-stripe";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * Phase 3 recurring population cycle (evaluate → notice → apply).
 *
 * GET  — scheduler / supercronic (Bearer CRON_SECRET)
 * POST — manual ops trigger (Bearer PRODUCT_SYNC_API_KEY or CRON_SECRET)
 *
 * Bounded pages of venues; notice/apply respect global gates and the
 * seven-day civil notice window. Notices redirect to the approved internal
 * inbox while TIER_UPGRADE_SEND_NOTICE=true.
 */
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

function parsePaging(url: URL, body: { limit?: number; offset?: number }) {
  const limitRaw = url.searchParams.get("limit") ?? body.limit;
  const offsetRaw = url.searchParams.get("offset") ?? body.offset;
  const limit = Math.min(
    Math.max(Number(limitRaw ?? 25) || 25, 1),
    25,
  );
  const offset = Math.max(Number(offsetRaw ?? 0) || 0, 0);
  return { limit, offset };
}

async function runCycle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!resolveSaasStripeSecretKey()) {
    return NextResponse.json(
      {
        error:
          "HTC_SAAS_STRIPE_SECRET_KEY missing — refuse cycle without authoritative Stripe retrieve",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const body =
    request.method === "POST"
      ? ((await request.json().catch(() => ({}))) as {
          limit?: number;
          offset?: number;
        })
      : {};
  const { limit, offset } = parsePaging(url, body);

  const admin = createAdminClient();
  const { data: venues, error } = await admin
    .from("venues")
    .select(
      "id, name, saas_stripe_subscription_id, saas_stripe_customer_id",
    )
    .not("saas_stripe_subscription_id", "is", null)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let stripe;
  let keySource: string;
  try {
    const client = await createSaasStripeClient();
    stripe = client.stripe;
    keySource = client.keySource;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe client failed" },
      { status: 503 },
    );
  }

  const store = getTierUpgradeStore();
  const offerStore = getPricingOfferStore();
  const sendNoticeGlobal = process.env.TIER_UPGRADE_SEND_NOTICE === "true";
  const applyStripeGlobal = process.env.TIER_UPGRADE_APPLY_STRIPE === "true";

  const listEvents = async (venueId: string) => {
    const { data: rows, error: eventsError } = await admin
      .from("events")
      .select("id, status, event_date, booked_at")
      .eq("venue_id", venueId);
    if (eventsError) throw new Error(eventsError.message);
    return (rows ?? []) as EventVolumeRow[];
  };

  const deps = {
    store,
    stripe: stripe as Parameters<typeof evaluateVenueTierUpgrade>[1]["stripe"],
    listEvents,
    listGrants: async (venueId: string) => {
      const earned = await offerStore.listEarnedGrantsForVenue(venueId);
      return earned.map((g) => ({
        id: g.id,
        offerType: g.offerType,
        percentOff: g.percentOff,
        status: g.status,
      }));
    },
  };

  const venueList = (venues ?? []) as VenueTierUpgradeSource[];
  const evaluations = [];
  let errors = 0;
  let mappedValid = 0;
  let alreadyCorrect = 0;
  let requiringUpgrade = 0;
  let blockedHold = 0;
  let blockedLegacy = 0;
  let skippedInvalid = 0;
  let pendingCreated = 0;

  for (const venue of venueList) {
    const outcome = await evaluateVenueTierUpgrade(venue, deps);
    evaluations.push(outcome);
    if (outcome.skipped) {
      skippedInvalid += 1;
      continue;
    }
    mappedValid += 1;
    const decision = outcome.decision || "";
    if (decision === "none" || decision === "cancel_pending") {
      alreadyCorrect += 1;
    }
    if (decision === "block_hold" || outcome.status === "blocked_hold") {
      blockedHold += 1;
    }
    if (decision === "block_legacy" || outcome.status === "blocked_legacy") {
      blockedLegacy += 1;
    }
    if (decision === "upsert_pending") {
      requiringUpgrade += 1;
      pendingCreated += 1;
    } else if (
      outcome.upgradeId &&
      ["pending_notice", "evaluated", "notice_sent", "scheduled"].includes(
        outcome.status || "",
      )
    ) {
      requiringUpgrade += 1;
    }
  }

  const notices = [];
  let noticesAccepted = 0;
  let noticeErrors = 0;

  if (sendNoticeGlobal) {
    for (const venue of venueList) {
      const upgrades = await store.listUpgradesForVenue(venue.id);
      const ready = upgrades.filter((u) =>
        ["pending_notice", "evaluated"].includes(u.status),
      );
      for (const upgrade of ready) {
        try {
          const sent = await sendNoticeForUpgrade({
            store,
            stripe: stripe as Parameters<typeof sendNoticeForUpgrade>[0]["stripe"],
            venue,
            upgrade,
            forceInternalRedirect: true,
          });
          notices.push(sent);
          if (sent.ok && sent.deliveryStatus === "provider_accepted") {
            noticesAccepted += 1;
          } else if (!sent.ok && !sent.skipped) {
            noticeErrors += 1;
            errors += 1;
          }
        } catch (err) {
          noticeErrors += 1;
          errors += 1;
          notices.push({
            venueId: venue.id,
            upgradeId: upgrade.id,
            ok: false,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  const applies = [];
  let schedulesCreatedOrUpdated = 0;
  let applyDeferred = 0;
  let applyErrors = 0;

  if (applyStripeGlobal) {
    for (const venue of venueList) {
      const upgrades = await store.listUpgradesForVenue(venue.id);
      const ready = upgrades.filter((u) =>
        ["notice_sent", "scheduled"].includes(u.status),
      );
      for (const upgrade of ready) {
        try {
          const applied = await applyScheduleForUpgrade({
            store,
            stripe: stripe as Parameters<
              typeof applyScheduleForUpgrade
            >[0]["stripe"],
            venue,
            upgrade,
            listEvents,
          });
          applies.push(applied);
          if (applied.ok) {
            schedulesCreatedOrUpdated += 1;
          } else if (applied.defer) {
            applyDeferred += 1;
          } else if (!applied.skipped) {
            applyErrors += 1;
            errors += 1;
          }
        } catch (err) {
          applyErrors += 1;
          errors += 1;
          applies.push({
            venueId: venue.id,
            upgradeId: upgrade.id,
            ok: false,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    offset,
    limit,
    counts: {
      venuesEvaluated: venueList.length,
      mappedValidSubscriptions: mappedValid,
      alreadyCorrectTier: alreadyCorrect,
      requiringUpgrade,
      blockedHold,
      blockedLegacy,
      skippedInvalidOrMissing: skippedInvalid,
      pendingUpgradesTouched: pendingCreated,
      noticesAcceptedByResend: noticesAccepted,
      stripeSchedulesCreatedOrUpdated: schedulesCreatedOrUpdated,
      applyDeferredForNoticeWindow: applyDeferred,
      errors,
      noticeErrors,
      applyErrors,
    },
    evaluations,
    notices,
    applies,
    stripeKeySource: keySource,
    gates: {
      applyStripe: applyStripeGlobal,
      sendNotice: sendNoticeGlobal,
      store: process.env.PRICING_TIER_UPGRADE_STORE || "memory",
      rehearsalEnabled: process.env.TIER_UPGRADE_REHEARSAL_ENABLED === "true",
    },
  });
}

export async function GET(request: Request) {
  return runCycle(request);
}

export async function POST(request: Request) {
  return runCycle(request);
}
