import { NextResponse } from "next/server";
import { resolvePortalTasks } from "@/lib/portal/service";

/**
 * GET /api/portal/tasks — venue-assigned tasks, client-fetchable.
 *
 * Tasks were previously only ever resolved server-side at page load
 * (`initialTasks`, app/(portal)/p/[token]/page.tsx) with no client route to
 * refresh them. The unified Tasks operational home (Client Collaboration
 * Workspace, 2026-07-22) needs to refetch after completing an item, the
 * same refetch-after-write pattern every other portal section already uses.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const tasks = await resolvePortalTasks(token);
  return NextResponse.json({ tasks });
}
