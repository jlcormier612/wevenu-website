import { NextResponse } from "next/server";

import { deletePortalTimelineEntry } from "@/lib/portal/service";

export async function POST(request: Request) {
  try {
    const { token, entryId } = (await request.json()) as { token?: string; entryId?: string };
    if (!token || !entryId) {
      return NextResponse.json({ ok: false, error: "Missing token or entryId." }, { status: 400 });
    }
    const result = await deletePortalTimelineEntry(token, entryId);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
