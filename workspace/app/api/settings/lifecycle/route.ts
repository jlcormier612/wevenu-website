import { NextResponse } from "next/server";

import {
  loadLifecycleSettings,
  saveLifecycleSettings,
} from "@/lib/lifecycle-settings";
import { actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

export async function GET() {
  await ensureProgram4Data();
  if (!(await actorCan("view_relationships"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const settings = await loadLifecycleSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  await ensureProgram4Data();
  if (!(await actorCan("manage_settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json()) as {
    whiteGlove?: { minBusinessDays?: number; maxBusinessDays?: number };
  };
  const settings = await saveLifecycleSettings({
    whiteGlove: {
      minBusinessDays: body.whiteGlove?.minBusinessDays,
      maxBusinessDays: body.whiteGlove?.maxBusinessDays,
    },
  });
  return NextResponse.json({ ok: true, settings });
}
