import { NextResponse } from "next/server";

import {
  evaluateEventVolume,
  formatUsdFromCents,
  getCatalogEntry,
  getTierUpgradeStore,
  listAmountCents,
  mapEventRowsToVolumeInputs,
  type EventVolumeRow,
  type SaasPlanKey,
} from "@shared/pricing";
import { hasCapability } from "@/lib/authorization";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { createAdminClient } from "@/integrations/supabase/admin";
import { getCurrentVenue } from "@/lib/venue/service";

export const runtime = "nodejs";

const PLAN_KEYS = new Set<SaasPlanKey>(["starter", "growing", "professional"]);

function asPlanKey(value: unknown): SaasPlanKey | null {
  if (typeof value === "string" && PLAN_KEYS.has(value as SaasPlanKey)) {
    return value as SaasPlanKey;
  }
  return null;
}

/**
 * Venue-facing read of current plan vs required tier / pending upgrade.
 * Never mutates billing state.
 *
 * Current plan must come from reconciled subscription state (pending upgrade's
 * currentPlanKey or venues.saas_plan_key). Never substitute volume-recommended
 * tier as the billed current plan.
 */
export async function GET() {
  const venue = await getCurrentVenue();
  if (!venue) {
    return NextResponse.json({ error: "No active venue" }, { status: 401 });
  }
  const membership = await getActiveVenueMembership();
  const canBilling =
    membership?.isOwner === true ||
    (membership ? hasCapability(membership, "account.billing") : false);
  if (!canBilling) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: venueRow } = await admin
    .from("venues")
    .select("saas_plan_key, current_period_end, saas_subscription_status")
    .eq("id", venue.id)
    .maybeSingle();

  const { data: rows } = await admin
    .from("events")
    .select("id, status, event_date, booked_at")
    .eq("venue_id", venue.id);
  const volume = evaluateEventVolume({
    events: mapEventRowsToVolumeInputs((rows ?? []) as EventVolumeRow[]),
  });

  const store = getTierUpgradeStore();
  const upgrades = await store.listUpgradesForVenue(venue.id);
  const pending =
    upgrades.find((u) =>
      [
        "evaluated",
        "pending_notice",
        "notice_sent",
        "scheduled",
        "blocked_hold",
        "blocked_legacy",
        "blocked_review",
        "failed",
      ].includes(u.status),
    ) ?? null;
  const lastApplied =
    upgrades.find((u) => u.status === "applied") ?? null;
  const hold = await store.getActiveHoldForVenue(venue.id);

  // After webhook marks applied, venues.saas_plan_key is authoritative.
  // While a pending upgrade exists, billed current remains the pending snapshot.
  const reconciledPlanKey =
    pending?.currentPlanKey ??
    asPlanKey(venueRow?.saas_plan_key) ??
    lastApplied?.requiredPlanKey ??
    null;

  const currentPlan = reconciledPlanKey
    ? {
        key: reconciledPlanKey,
        name: getCatalogEntry(reconciledPlanKey).name,
        source: pending ? ("pending_upgrade_snapshot" as const) : ("venue_saas_plan_key" as const),
        available: true as const,
      }
    : {
        key: null,
        name: null,
        source: "unavailable" as const,
        available: false as const,
      };

  const currentRecurringAmountCents = reconciledPlanKey
    ? lastApplied && lastApplied.requiredPlanKey === reconciledPlanKey
      ? lastApplied.expectedRecurringAmountCents
      : listAmountCents(reconciledPlanKey)
    : null;

  return NextResponse.json({
    ok: true,
    venueId: venue.id,
    currentPlan,
    currentRecurringAmount:
      currentRecurringAmountCents != null
        ? formatUsdFromCents(currentRecurringAmountCents)
        : null,
    currentRecurringAmountCents,
    scheduledEffectivePlan: pending?.scheduledEffectiveAt
      ? {
          key: pending.requiredPlanKey,
          name: getCatalogEntry(pending.requiredPlanKey).name,
          effectiveAt: pending.scheduledEffectiveAt,
          activeNow: false,
        }
      : null,
    volume: {
      peakCount: volume.peakCount,
      peakYear: volume.peakYear,
      recommendedPlan: volume.recommendedPlan,
      recommendedPlanName: getCatalogEntry(volume.recommendedPlan).name,
      byYear: volume.byYear,
    },
    pendingUpgrade: pending
      ? {
          id: pending.id,
          status: pending.status,
          currentPlanName: getCatalogEntry(pending.currentPlanKey).name,
          requiredPlanName: getCatalogEntry(pending.requiredPlanKey).name,
          effectiveAt: pending.scheduledEffectiveAt,
          noticeSentAt: pending.noticeSentAt,
          noticeDeliveryStatus: pending.noticeDeliveryStatus,
          currentAmount: formatUsdFromCents(pending.currentListAmountCents),
          newAmount: formatUsdFromCents(pending.expectedRecurringAmountCents),
          discountPercent: pending.appliedPercentOff,
          skippedImminentRenewal: pending.skippedImminentRenewal,
          activeNow: false,
        }
      : null,
    lastAppliedUpgrade: lastApplied
      ? {
          id: lastApplied.id,
          status: lastApplied.status,
          fromPlanName: getCatalogEntry(lastApplied.currentPlanKey).name,
          toPlanName: getCatalogEntry(lastApplied.requiredPlanKey).name,
          effectiveAt: lastApplied.scheduledEffectiveAt,
          invoiceId:
            typeof lastApplied.metadata?.appliedInvoiceId === "string"
              ? lastApplied.metadata.appliedInvoiceId
              : null,
          amount: formatUsdFromCents(lastApplied.expectedRecurringAmountCents),
        }
      : null,
    holdActive: Boolean(hold),
    subscriptionStatus: venueRow?.saas_subscription_status ?? null,
  });
}
