import { NextResponse } from "next/server";

import { resolveSupportInboxItem } from "@shared/relationships";

import { actorCan, getActingMember } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

/**
 * Support inbox actions (vendor + client product feedback).
 * POST { action: "resolve", itemId, note? }
 */
export async function POST(request: Request) {
  await ensureProgram4Data();

  const canAct =
    (await actorCan("edit_relationships")) ||
    (await actorCan("manage_communications"));
  if (!canAct) {
    return NextResponse.json(
      { error: "You do not have permission to manage support" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    action?: string;
    itemId?: string | null;
    note?: string | null;
  };

  if (body.action !== "resolve") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (!body.itemId?.trim()) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  const actor = await getActingMember();
  const result = await resolveSupportInboxItem({
    itemId: body.itemId.trim(),
    note: body.note ?? (actor ? `Resolved by ${actor.name}` : null),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, item: result.item });
}
