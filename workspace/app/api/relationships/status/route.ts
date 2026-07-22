import { NextResponse } from "next/server";

import { getRelationship } from "@/lib/data/store";
import { isPipelineStatus } from "@/lib/pipeline";
import { moveRelationshipStatus } from "@/lib/program3/engine";
import { ensureProgram3Data } from "@/lib/program3/store";

export async function POST(request: Request) {
  await ensureProgram3Data();
  const body = (await request.json()) as {
    relationshipId?: string;
    status?: string;
  };

  if (!body.relationshipId || !body.status) {
    return NextResponse.json({ error: "relationshipId and status required" }, { status: 400 });
  }
  if (!isPipelineStatus(body.status)) {
    return NextResponse.json({ error: "Invalid pipeline status" }, { status: 400 });
  }

  const existing = getRelationship(body.relationshipId);
  if (!existing) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }

  const result = await moveRelationshipStatus(body.relationshipId, body.status, {
    getRelationship,
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: result.status });
}
