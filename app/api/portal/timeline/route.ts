import { NextResponse } from "next/server";

import { updatePortalTimelineEntry } from "@/lib/portal/service";

export async function POST(request: Request) {
  try {
    const { token, entryId, title, description, entryTime } = (await request.json()) as {
      token?: string; entryId?: string; title?: string; description?: string; entryTime?: string;
    };
    if (!token || !entryId || !title) {
      return NextResponse.json({ ok: false, error: "Missing token, entryId, or title." }, { status: 400 });
    }
    const result = await updatePortalTimelineEntry(token, entryId, title, description ?? "", entryTime ?? "");
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
