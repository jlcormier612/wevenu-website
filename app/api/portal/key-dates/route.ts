import { NextResponse } from "next/server";

import { resolvePortalKeyDates } from "@/lib/portal/service";

// GET /api/portal/key-dates — venue-authored Key Dates, surfaced in the
// Couple Workspace (Program 4, Initiative C, Phase 3).
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const keyDates = await resolvePortalKeyDates(token);
  return NextResponse.json({ keyDates });
}
