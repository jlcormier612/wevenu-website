import { NextResponse } from "next/server";
import { resolvePortalTasks, resolvePortalVendorTasks } from "@/lib/portal/service";

/**
 * GET /api/portal/tasks — venue-assigned tasks + shared vendor→couple tasks.
 *
 * vendorTasks is a separate array (not mixed into venue tasks).
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const [tasks, vendorTasks] = await Promise.all([
    resolvePortalTasks(token),
    resolvePortalVendorTasks(token),
  ]);
  return NextResponse.json({ tasks, vendorTasks });
}
