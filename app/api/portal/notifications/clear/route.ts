import { NextResponse } from "next/server";

import { clearCoupleNotifications } from "@/lib/couple-notifications/service";

export async function POST(request: Request) {
  const body = await request.json() as { token?: string; ids?: string[] };
  const token = body.token?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const result = await clearCoupleNotifications(token, body.ids ?? []);
  if (result.error === "invalid_token") {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json(result);
}
