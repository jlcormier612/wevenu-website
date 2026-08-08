import { NextResponse } from "next/server";

import { resolvePortalTimeline, updatePortalTimelineEntry } from "@/lib/portal/service";

// GET so the client can refresh Timeline Status (lastSubmittedAt /
// hasUnpublishedChanges) after any mutating action, the same
// refetch-after-write pattern already used by Vendor Selection and
// Documents on this portal.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const timeline = await resolvePortalTimeline(token);
  return NextResponse.json(timeline);
}

export async function POST(request: Request) {
  try {
    const { token, entryId, title, description, entryTime, dayOffset, endTime } = (await request.json()) as {
      token?: string; entryId?: string; title?: string; description?: string; entryTime?: string; dayOffset?: number; endTime?: string;
    };
    if (!token || !entryId || !title) {
      return NextResponse.json({ ok: false, error: "Missing token, entryId, or title." }, { status: 400 });
    }
    const result = await updatePortalTimelineEntry(
      token, entryId, title, description ?? "", entryTime ?? "", undefined, dayOffset ?? 0, endTime ?? "",
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
