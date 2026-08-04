/**
 * Hands-off scheduler for delayed Sequence + Workflow steps (and lifecycle ticks).
 *
 * Vercel Cron (see workspace/vercel.json): every 10 minutes.
 * Auth: Authorization: Bearer {CRON_SECRET} when CRON_SECRET is set.
 *
 * Page-load / enroll still tick engines in-process — this route is the
 * background worker so delayed steps advance without someone opening the app.
 */
import { NextResponse } from "next/server";

import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";
import { tickAutomations } from "@/lib/program3/tick-automations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorizedResponse();
  }

  try {
    const result = await tickAutomations({ includeLifecycle: true });
    console.log(
      `[cron] automations: sequences processed=${result.sequences.processed} steps=${result.sequences.completedSteps} workflows processed=${result.workflows.processed} steps=${result.workflows.completedSteps} renewals=${result.renewals?.length ?? 0} dunning=${result.dunning?.length ?? 0}`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] automations error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET — Vercel Cron trigger */
export async function GET(request: Request) {
  return handle(request);
}

/** POST — ops / local curl */
export async function POST(request: Request) {
  return handle(request);
}
