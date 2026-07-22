import { NextResponse } from "next/server";

import { getRelationship } from "@/lib/data/store";
import { tickSequences } from "@/lib/program3/sequence-engine";
import { ensureProgram3Data } from "@/lib/program3/store";

/**
 * Process due sequence steps (scheduledFor <= now).
 * Call via cron, or pages that tick on load (/sequences, relationship detail).
 */
export async function POST() {
  await ensureProgram3Data();
  const result = await tickSequences(getRelationship);
  return NextResponse.json({ ok: true, ...result, tickedAt: new Date().toISOString() });
}

export async function GET() {
  return POST();
}
