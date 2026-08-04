import { NextResponse } from "next/server";

import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";
import { getRelationship } from "@/lib/data/store";
import { tickWorkflows } from "@/lib/program3/engine";
import { ensureProgram3Data } from "@/lib/program3/store";

/**
 * Process due workflow steps.
 *
 * Cron preferred: GET|POST /api/cron/automations (see vercel.json).
 * This route remains for targeted ops / local curl.
 * Pages still tick in-process on load (Workflows / Sales / CS / detail).
 * Enroll still ticks immediately.
 *
 * Auth: Bearer CRON_SECRET when set; open in local when unset.
 */
async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorizedResponse();
  }
  await ensureProgram3Data();
  const result = await tickWorkflows(getRelationship);
  return NextResponse.json({ ok: true, ...result, tickedAt: new Date().toISOString() });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
