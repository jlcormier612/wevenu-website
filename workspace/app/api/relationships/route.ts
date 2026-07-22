import { NextResponse } from "next/server";

import { ingestManualRelationship } from "@shared/relationships";

import { getActingMember, actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

/**
 * POST /api/relationships — Add Relationship (manual).
 * Permission: edit_relationships
 */
export async function POST(request: Request) {
  await ensureProgram4Data();

  if (!(await actorCan("edit_relationships"))) {
    return NextResponse.json(
      { error: "You do not have permission to add relationships" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    venueName?: string;
    ownerName?: string;
    email?: string;
    phone?: string;
    notes?: string;
  };

  const venueName = body.venueName?.trim();
  const email = body.email?.trim();
  if (!venueName) {
    return NextResponse.json({ error: "venueName required" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const actor = await getActingMember();
  const result = await ingestManualRelationship({
    venueName,
    ownerName: body.ownerName,
    email,
    phone: body.phone,
    notes: body.notes,
    actorId: actor.id,
  });

  return NextResponse.json({
    ok: true,
    created: result.created,
    relationshipId: result.relationship.id,
  });
}
