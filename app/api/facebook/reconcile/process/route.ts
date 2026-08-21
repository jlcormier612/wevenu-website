/**
 * /api/facebook/reconcile/process — hourly backup poll for any webhook
 * Meta failed to deliver. See lib/facebook/reconcile.ts.
 */
import { NextResponse } from "next/server";

import { reconcileFacebookLeads } from "@/lib/facebook/reconcile";

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await reconcileFacebookLeads();
    console.log(`[cron] facebook reconcile: ${result.venuesChecked} forms checked, ${result.leadsEnqueued} leads enqueued`);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] facebook reconcile error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
