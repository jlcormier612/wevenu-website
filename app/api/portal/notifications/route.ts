import { NextResponse } from "next/server";

import { getCoupleNotifications } from "@/lib/couple-notifications/service";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await getCoupleNotifications(token);
  if (result.error === "invalid_token") {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json({
    notifications: result.notifications,
    unreadCount: result.unreadCount,
  });
}
