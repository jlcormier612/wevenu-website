import { NextResponse } from "next/server";

import { addPortalTimelineEntry } from "@/lib/portal/service";

export async function POST(request: Request) {
  try {
    const { token, sectionId, title, description, entryTime } = (await request.json()) as {
      token?: string; sectionId?: string; title?: string; description?: string; entryTime?: string;
    };
    if (!token || !sectionId || !title) {
      return NextResponse.json({ ok: false, error: "Missing token, sectionId, or title." }, { status: 400 });
    }
    const result = await addPortalTimelineEntry(token, sectionId, title, description ?? "", entryTime ?? "");
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
