import { NextResponse } from "next/server";
import { getPublicProtectionStatus } from "@/lib/tours/protection";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key")?.trim() ?? "";
  const sessionId = url.searchParams.get("session_id")?.trim() ?? "";
  if (!key || !sessionId) {
    return NextResponse.json({ ok: false, error: "Missing session." }, { status: 400 });
  }
  const status = await getPublicProtectionStatus({ embedKey: key, sessionId });
  return NextResponse.json({ ok: true, ...status });
}
