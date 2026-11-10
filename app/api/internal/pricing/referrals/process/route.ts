/**
 * Phase 6 scheduler tick — qualification, optional issuance, invoice reconcile.
 * Isolated from Phase 3/4/5 processors so failures never interrupt those paths.
 */

import { NextResponse } from "next/server";

import {
  getReferralProgramReadiness,
  isReferralProgramReady,
  isReferralRewardIssueEnabled,
  processReferralLifecycle,
} from "@shared/pricing";
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

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const readiness = getReferralProgramReadiness();
  if (!isReferralProgramReady(readiness)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      readiness,
      reason: readiness.diagnosticMessage,
    });
  }

  const url = new URL(request.url);
  const autoIssue =
    url.searchParams.get("autoIssue") === "1" ||
    isReferralRewardIssueEnabled();

  const ctx = createReferralServiceContext({ includeStripe: true });
  const result = await processReferralLifecycle(ctx, {
    limit: 25,
    autoIssueApproved: autoIssue,
    actorEmail: "scheduler",
  });

  return NextResponse.json({
    ...result,
    readiness,
    rewardIssueEnabled: isReferralRewardIssueEnabled(),
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
