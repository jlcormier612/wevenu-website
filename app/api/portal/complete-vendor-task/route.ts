import { NextResponse } from "next/server";

import { completePortalVendorTask } from "@/lib/portal/service";

/** POST /api/portal/complete-vendor-task — couple completes an owned vendor_tasks row. */
export async function POST(request: Request) {
  try {
    const { token, taskId } = (await request.json()) as { token?: string; taskId?: string };
    if (!token || !taskId) {
      return NextResponse.json({ ok: false, error: "Missing token or taskId." }, { status: 400 });
    }
    const result = await completePortalVendorTask(token, taskId);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
