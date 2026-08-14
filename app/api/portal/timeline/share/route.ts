import { NextResponse } from "next/server";

import { sharePortalTimelineWithVendor } from "@/lib/portal/service";

/** POST /api/portal/timeline/share — durable share with one assigned vendor. */
export async function POST(request: Request) {
  try {
    const { token, vendorId } = (await request.json()) as {
      token?: string;
      vendorId?: string;
    };
    if (!token || !vendorId) {
      return NextResponse.json(
        { ok: false, error: "Missing token or vendorId." },
        { status: 400 },
      );
    }
    const result = await sharePortalTimelineWithVendor(token, vendorId);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
