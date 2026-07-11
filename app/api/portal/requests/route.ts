/**
 * /api/portal/requests — the Wedding Workspace Request Center's list.
 * GET ?token=... → every Request visible to this session's client
 * (Wedding Workspace – Request Experience, Phase 1).
 */
import { NextResponse } from "next/server";
import { getPortalRequests } from "@/lib/requests/portal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const requests = await getPortalRequests(token);
  return NextResponse.json({ requests });
}
