/**
 * /api/texting/provision/process — advance venue texting self-service steps.
 *
 * GET  — cron (Authorization: Bearer CRON_SECRET)
 * POST — manual (x-texting-provision-secret or CRON_SECRET)
 */
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/auth/cron-auth";
import { isTextingSelfServiceProvisioningEnabled } from "@/lib/texting-provisioning/feature";
import { processTextingProvisioningQueue } from "@/lib/texting-provisioning/processor";

function isManualAuthorized(request: Request): boolean {
  const secret = process.env.TEXTING_PROVISION_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return (
    request.headers.get("x-texting-provision-secret") === secret
    || request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTextingSelfServiceProvisioningEnabled()) {
    return NextResponse.json({ skipped: true, reason: "self_service_disabled" });
  }
  try {
    const result = await processTextingProvisioningQueue(8);
    console.log(
      `[cron] texting provision: processed=${result.processed} advanced=${result.advanced} waiting=${result.waiting} failed=${result.failed}`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] texting provision error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isManualAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTextingSelfServiceProvisioningEnabled()) {
    return NextResponse.json({ skipped: true, reason: "self_service_disabled" });
  }
  try {
    const result = await processTextingProvisioningQueue(8);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
