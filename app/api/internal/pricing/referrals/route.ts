/**
 * Phase 6 referrals — server-to-server (workspace CRM → venue-app).
 * Auth: Bearer PRODUCT_SYNC_API_KEY or CRON_SECRET.
 */

import { NextResponse } from "next/server";

import {
  approveReferralReward,
  confirmReferralAttribution,
  evaluateReferralQualification,
  founderUpdateReferral,
  getReferralProgramReadiness,
  isReferralProgramReady,
  issueReferralRewardCredit,
  markAttributionPaid,
  rejectReferralReward,
  type ReferralWorkflowStatus,
} from "@shared/pricing";
import { getReferralStore } from "@shared/pricing/referral-store-access";
import { createReferralServiceContext } from "@/lib/referrals/service-context";

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

const WORKFLOW: ReferralWorkflowStatus[] = [
  "submitted",
  "under_review",
  "contacted",
  "interested",
  "converted",
  "qualification_pending",
  "reward_eligible",
  "reward_issued",
  "closed_not_eligible",
  "closed_duplicate",
  "closed_declined",
];

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const readiness = getReferralProgramReadiness();
  const url = new URL(request.url);
  const referralId = url.searchParams.get("referralId");
  const store = getReferralStore();

  if (referralId) {
    const referral = await store.getReferral(referralId);
    if (!referral) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const attributions = await store.listAttributionsForReferral(referralId);
    const reward = await store.getRewardForReferral(referralId);
    const activity = await store.listActivity(referralId);
    return NextResponse.json({
      ok: true,
      readiness,
      referral,
      attributions,
      reward,
      activity,
    });
  }

  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && WORKFLOW.includes(statusParam as ReferralWorkflowStatus)
      ? (statusParam as ReferralWorkflowStatus)
      : null;
  const search = url.searchParams.get("search");
  const referrals = await store.listReferrals({
    status,
    search,
    limit: 200,
  });

  return NextResponse.json({
    ok: true,
    readiness,
    referrals,
  });
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const readiness = getReferralProgramReadiness();
  if (!isReferralProgramReady(readiness)) {
    return NextResponse.json(
      { error: readiness.diagnosticMessage, readiness },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const action = String(body.action ?? "");
  const actorEmail =
    typeof body.actorEmail === "string" && body.actorEmail.trim()
      ? body.actorEmail.trim()
      : "founder";

  const ctx = createReferralServiceContext({ includeStripe: true });

  try {
    switch (action) {
      case "update": {
        const referralId = String(body.referralId ?? "");
        if (!referralId) {
          return NextResponse.json({ error: "referralId required" }, { status: 400 });
        }
        const status =
          typeof body.status === "string" &&
          WORKFLOW.includes(body.status as ReferralWorkflowStatus)
            ? (body.status as ReferralWorkflowStatus)
            : undefined;
        const referral = await founderUpdateReferral(ctx, {
          referralId,
          actorEmail,
          status,
          assignedOwnerEmail:
            body.assignedOwnerEmail === null
              ? null
              : typeof body.assignedOwnerEmail === "string"
                ? body.assignedOwnerEmail
                : undefined,
          linkedRelationshipId:
            body.linkedRelationshipId === null
              ? null
              : typeof body.linkedRelationshipId === "string"
                ? body.linkedRelationshipId
                : undefined,
          linkedVenueId:
            body.linkedVenueId === null
              ? null
              : typeof body.linkedVenueId === "string"
                ? body.linkedVenueId
                : undefined,
          note: typeof body.note === "string" ? body.note : null,
          markExistingPayingCustomer: body.markExistingPayingCustomer === true,
        });
        return NextResponse.json({ ok: true, referral });
      }

      case "attribute": {
        const referralId = String(body.referralId ?? "");
        const referredVenueId = String(body.referredVenueId ?? "");
        if (!referralId || !referredVenueId) {
          return NextResponse.json(
            { error: "referralId and referredVenueId required" },
            { status: 400 },
          );
        }
        const attribution = await confirmReferralAttribution(ctx, {
          referralId,
          referredVenueId,
          actorEmail,
          matchMethod:
            body.matchMethod === "website_domain" ||
            body.matchMethod === "business_identity" ||
            body.matchMethod === "enrollment_association"
              ? body.matchMethod
              : "founder_confirmed",
          matchEvidence:
            body.matchEvidence && typeof body.matchEvidence === "object"
              ? (body.matchEvidence as Record<string, unknown>)
              : {},
          firstPaidInvoiceId:
            typeof body.firstPaidInvoiceId === "string"
              ? body.firstPaidInvoiceId
              : null,
          firstPaidInvoiceAt:
            typeof body.firstPaidInvoiceAt === "string"
              ? body.firstPaidInvoiceAt
              : null,
          convertedAt:
            typeof body.convertedAt === "string" ? body.convertedAt : null,
        });
        return NextResponse.json({ ok: true, attribution });
      }

      case "mark_paid": {
        const attributionId = String(body.attributionId ?? "");
        const firstPaidInvoiceId = String(body.firstPaidInvoiceId ?? "");
        const firstPaidInvoiceAt = String(body.firstPaidInvoiceAt ?? "");
        if (!attributionId || !firstPaidInvoiceId || !firstPaidInvoiceAt) {
          return NextResponse.json(
            { error: "attributionId, firstPaidInvoiceId, firstPaidInvoiceAt required" },
            { status: 400 },
          );
        }
        const attribution = await markAttributionPaid(ctx, {
          attributionId,
          firstPaidInvoiceId,
          firstPaidInvoiceAt,
          actorEmail,
        });
        return NextResponse.json({ ok: true, attribution });
      }

      case "evaluate_qualification": {
        const attributionId = String(body.attributionId ?? "");
        if (!attributionId) {
          return NextResponse.json(
            { error: "attributionId required" },
            { status: 400 },
          );
        }
        const reward = await evaluateReferralQualification(ctx, attributionId, {
          actorEmail,
          forceNow: body.forceNow === true,
        });
        return NextResponse.json({ ok: true, reward });
      }

      case "approve_reward": {
        const rewardId = String(body.rewardId ?? "");
        if (!rewardId) {
          return NextResponse.json({ error: "rewardId required" }, { status: 400 });
        }
        const reward = await approveReferralReward(ctx, {
          rewardId,
          actorEmail,
          notes: typeof body.notes === "string" ? body.notes : null,
        });
        return NextResponse.json({ ok: true, reward });
      }

      case "reject_reward": {
        const rewardId = String(body.rewardId ?? "");
        const reason = String(body.reason ?? "").trim();
        if (!rewardId || !reason) {
          return NextResponse.json(
            { error: "rewardId and reason required" },
            { status: 400 },
          );
        }
        const reward = await rejectReferralReward(ctx, {
          rewardId,
          actorEmail,
          reason,
        });
        return NextResponse.json({ ok: true, reward });
      }

      case "issue_reward": {
        const rewardId = String(body.rewardId ?? "");
        if (!rewardId) {
          return NextResponse.json({ error: "rewardId required" }, { status: 400 });
        }
        const reward = await issueReferralRewardCredit(ctx, rewardId, {
          actorEmail,
        });
        if (reward.status === "issued") {
          try {
            const { notifyReferralRewardEarned } = await import(
              "@/lib/referrals/notify"
            );
            const referral = await getReferralStore().getReferral(reward.referralId);
            const referrer = await ctx.loadVenue(reward.referringVenueId);
            await notifyReferralRewardEarned({
              toEmail: referral?.submittedByEmail ?? null,
              venueName: referrer?.name || "there",
              amountCents: reward.rewardAmountCents,
              referredVenueName: referral?.referredVenueName || "your referral",
            });
          } catch {
            // Notification failure must not roll back durable issuance.
          }
        }
        return NextResponse.json({ ok: true, reward });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
