import { NextResponse } from "next/server";

import {
  formatUsdFromCents,
  getCatalogEntry,
  getTierUpgradeStore,
  type TierUpgradeStatus,
} from "@shared/pricing";

import { actorCan } from "@/lib/program4/actor";

export const runtime = "nodejs";

const STATUSES = new Set<TierUpgradeStatus>([
  "evaluated",
  "pending_notice",
  "notice_sent",
  "scheduled",
  "applied",
  "superseded",
  "cancelled",
  "failed",
  "blocked_hold",
  "blocked_legacy",
  "blocked_review",
]);

/**
 * Founder CRM visibility into pending / blocked / scheduled tier upgrades.
 * Holds: POST { action: "place_hold" | "release_hold", ... }
 * Billing mutations never happen here.
 */
export async function GET(request: Request) {
  if (!(await actorCan("manage_welcome_back"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status")?.trim() || null;
  if (statusParam && !STATUSES.has(statusParam as TierUpgradeStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const store = getTierUpgradeStore();
  const rows = statusParam
    ? await store.listUpgradesByStatus(statusParam as TierUpgradeStatus, 200)
    : (
        await Promise.all(
          [
            "pending_notice",
            "notice_sent",
            "scheduled",
            "blocked_hold",
            "blocked_legacy",
            "blocked_review",
            "failed",
          ].map((s) => store.listUpgradesByStatus(s as TierUpgradeStatus, 100)),
        )
      ).flat();

  return NextResponse.json({
    ok: true,
    upgrades: rows.map((u) => ({
      id: u.id,
      venueId: u.venueId,
      subscriptionId: u.stripeSubscriptionId,
      status: u.status,
      currentPlan: getCatalogEntry(u.currentPlanKey).name,
      requiredPlan: getCatalogEntry(u.requiredPlanKey).name,
      peakCount: u.peakCount,
      peakYear: u.peakYear,
      effectiveAt: u.scheduledEffectiveAt,
      noticeSentAt: u.noticeSentAt,
      currentAmount: formatUsdFromCents(u.currentListAmountCents),
      expectedAmount: formatUsdFromCents(u.expectedRecurringAmountCents),
      discountPercent: u.appliedPercentOff,
      skippedImminentRenewal: u.skippedImminentRenewal,
    })),
  });
}

export async function POST(request: Request) {
  if (!(await actorCan("manage_welcome_back"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    venueId?: string;
    stripeSubscriptionId?: string | null;
    reason?: string;
    expiresAt?: string | null;
    holdId?: string;
    releaseReason?: string | null;
    actorEmail?: string;
  };

  const store = getTierUpgradeStore();
  const actor = body.actorEmail?.trim() || "founder";

  if (body.action === "place_hold") {
    if (!body.venueId?.trim() || !body.reason?.trim()) {
      return NextResponse.json(
        { error: "venueId and reason are required" },
        { status: 400 },
      );
    }
    const hold = await store.placeHold({
      venueId: body.venueId.trim(),
      stripeSubscriptionId: body.stripeSubscriptionId ?? null,
      reason: body.reason.trim(),
      placedBy: actor,
      expiresAt: body.expiresAt ?? null,
    });
    return NextResponse.json({
      ok: true,
      hold,
      billingUnchanged: true,
    });
  }

  if (body.action === "release_hold") {
    if (!body.holdId?.trim()) {
      return NextResponse.json({ error: "holdId is required" }, { status: 400 });
    }
    const hold = await store.releaseHold({
      holdId: body.holdId.trim(),
      releasedBy: actor,
      releaseReason: body.releaseReason ?? null,
    });
    return NextResponse.json({
      ok: true,
      hold,
      billingUnchanged: true,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
