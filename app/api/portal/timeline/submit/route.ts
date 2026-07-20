import { NextResponse } from "next/server";

import { submitPortalTimeline } from "@/lib/portal/service";

// The couple's whole-timeline Commitment Lifecycle Submit event — the
// Timeline planning Task's commit point. Creates a new immutable snapshot
// for the venue; does not freeze the couple's own workspace.
export async function POST(request: Request) {
  try {
    const { token, clientId } = (await request.json()) as { token?: string; clientId?: string };
    if (!token || !clientId) {
      return NextResponse.json({ ok: false, error: "Missing token or clientId." }, { status: 400 });
    }
    const result = await submitPortalTimeline(token, clientId);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
