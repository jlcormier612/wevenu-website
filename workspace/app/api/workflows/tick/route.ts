import { NextResponse } from "next/server";

import { getRelationship } from "@/lib/data/store";
import { tickWorkflows } from "@/lib/program3/engine";
import { ensureProgram3Data } from "@/lib/program3/store";

/**
 * Process due workflow steps.
 * Call via cron or visit any workflows page (also ticks on load).
 */
export async function POST() {
  await ensureProgram3Data();
  const result = await tickWorkflows(getRelationship);
  return NextResponse.json({ ok: true, ...result, tickedAt: new Date().toISOString() });
}

export async function GET() {
  return POST();
}
