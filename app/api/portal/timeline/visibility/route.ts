import { NextResponse } from "next/server";

import { setPortalTimelineEntryVisibility } from "@/lib/portal/service";

export async function POST(request: Request) {
  try {
    const { token, entryId, audiences } = (await request.json()) as {
      token?: string; entryId?: string; audiences?: string[];
    };
    if (!token || !entryId || !Array.isArray(audiences)) {
      return NextResponse.json({ ok: false, error: "Missing token, entryId, or audiences." }, { status: 400 });
    }
    const result = await setPortalTimelineEntryVisibility(token, entryId, audiences);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
