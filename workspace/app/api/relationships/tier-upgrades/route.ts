import { NextResponse } from "next/server";

import {
  formatUsdFromCents,
  getCatalogEntry,
  getTierUpgradeStore,
  type TierUpgradeStatus,
} from "@shared/pricing";

import { actorCan, getSessionMember } from "@/lib/program4/session";

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

async function requireFounderSession(): Promise<Response | null> {
  // Do not fall through to DEFAULT_ACTOR_ID — unauthenticated callers must be denied.
  const session = await getSessionMember();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await actorCan("manage_welcome_back"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Founder CRM visibility into pending / blocked / scheduled tier upgrades.
 * Holds: POST { action: "place_hold" | "release_hold", ... }
 * Billing mutations never happen here.
 */
export async function GET(request: Request) {
  const denied = await requireFounderSession();
  if (denied) return denied;

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
            "applied",
            "cancelled",
            "blocked_hold",
            "blocked_legacy",
            "blocked_review",
            "failed",
          ].map((s) => store.listUpgradesByStatus(s as TierUpgradeStatus, 100)),
        )
      ).flat();

  const venueIds = [...new Set(rows.map((u) => u.venueId))];
  const venueNameById = new Map<string, string>();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey && venueIds.length > 0) {
    const filter = venueIds.map(encodeURIComponent).join(",");
    const res = await fetch(
      `${supabaseUrl}/rest/v1/venues?id=in.(${filter})&select=id,name`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      },
    ).catch(() => null);
    if (res?.ok) {
      const venues = (await res.json()) as Array<{ id: string; name: string | null }>;
      for (const v of venues) {
        venueNameById.set(v.id, v.name || v.id);
      }
    }
  }

  const holds = (
    await Promise.all(venueIds.map((id) => store.getActiveHoldForVenue(id)))
  ).filter((h): h is NonNullable<typeof h> => Boolean(h));

  const holdByVenue = new Map(holds.map((h) => [h.venueId, h]));

  return NextResponse.json({
    ok: true,
    upgrades: rows.map((u) => {
      const hold = holdByVenue.get(u.venueId) ?? null;
      return {
        id: u.id,
        venueId: u.venueId,
        venueName: venueNameById.get(u.venueId) ?? null,
        subscriptionId: u.stripeSubscriptionId,
        status: u.status,
        currentPlan: getCatalogEntry(u.currentPlanKey).name,
        requiredPlan: getCatalogEntry(u.requiredPlanKey).name,
        peakCount: u.peakCount,
        peakYear: u.peakYear,
        effectiveAt: u.scheduledEffectiveAt,
        noticeSentAt: u.noticeSentAt,
        noticeDeliveryStatus: u.noticeDeliveryStatus,
        noticeProviderMessageId: u.noticeProviderMessageId,
        stripeScheduleId: u.stripeScheduleId,
        currentAmount: formatUsdFromCents(u.currentListAmountCents),
        expectedAmount: formatUsdFromCents(u.expectedRecurringAmountCents),
        discountPercent: u.appliedPercentOff,
        skippedImminentRenewal: u.skippedImminentRenewal,
        appliedInvoiceId:
          typeof u.metadata?.appliedInvoiceId === "string"
            ? u.metadata.appliedInvoiceId
            : null,
        holdActive: Boolean(hold),
        holdId: hold?.id ?? null,
        audit: u.audit.slice(-12),
      };
    }),
    holds: holds.map((h) => ({
      id: h.id,
      venueId: h.venueId,
      stripeSubscriptionId: h.stripeSubscriptionId,
      reason: h.reason,
      placedBy: h.placedBy,
      placedAt: h.placedAt,
      active: h.active,
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
