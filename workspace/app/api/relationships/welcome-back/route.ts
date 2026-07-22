import { NextResponse } from "next/server";

import type { WelcomeBackAction } from "@shared/relationships";

import { actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import { resolveWelcomeBackInWorkspace } from "@/lib/welcome-back/resolve";

const ACTIONS = new Set<WelcomeBackAction>([
  "approve",
  "reject",
  "needs_follow_up",
]);

export async function POST(request: Request) {
  await ensureProgram4Data();

  if (!(await actorCan("manage_welcome_back"))) {
    return NextResponse.json(
      { error: "You do not have permission to verify Welcome Back" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    relationshipId?: string;
    action?: string;
    note?: string | null;
  };

  if (!body.relationshipId?.trim()) {
    return NextResponse.json({ error: "relationshipId required" }, { status: 400 });
  }
  if (!body.action || !ACTIONS.has(body.action as WelcomeBackAction)) {
    return NextResponse.json(
      { error: "action must be approve, reject, or needs_follow_up" },
      { status: 400 },
    );
  }

  const result = await resolveWelcomeBackInWorkspace({
    relationshipId: body.relationshipId,
    action: body.action as WelcomeBackAction,
    note: body.note,
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
