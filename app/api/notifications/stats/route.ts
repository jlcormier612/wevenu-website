import { NextResponse } from "next/server";

import { getNotificationStats } from "@/lib/notifications/stats";

/** GET — refresh reminder queue counts for Settings UI after Send Now. */
export async function GET() {
  try {
    const stats = await getNotificationStats();
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
