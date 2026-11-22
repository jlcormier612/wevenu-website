import { NextResponse } from "next/server";

import { markNotificationsRead } from "@shared/relationships";

import { requireWorkspaceStaff } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

/** POST { ids: string[] } — mark workspace CRM notifications as read. */
export async function POST(request: Request) {
  const auth = await requireWorkspaceStaff();
  if (!auth.ok) return auth.response;
  await ensureProgram4Data();
  const actor = auth.actor;
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const result = await markNotificationsRead(ids);
  return NextResponse.json({ ok: true, marked: result.marked });
}
