import { NextResponse } from "next/server";

import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";
import { getRelationship } from "@/lib/data/store";
import { tickSequences } from "@/lib/program3/sequence-engine";
import { ensureProgram3Data } from "@/lib/program3/store";

/**
 * Process due sequence steps (scheduledFor <= now).
 *
 * Cron preferred: GET|POST /api/cron/automations (see vercel.json).
 * This route remains for targeted ops / local curl.
 * Pages still tick in-process on load (/sequences, relationship detail).
 * Enroll still ticks immediately — stop-on-reply is unchanged.
 *
 * Auth: Bearer CRON_SECRET when set; open in local when unset.
 */
async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorizedResponse();
  }
  await ensureProgram3Data();
  const result = await tickSequences(getRelationship);
  return NextResponse.json({ ok: true, ...result, tickedAt: new Date().toISOString() });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
