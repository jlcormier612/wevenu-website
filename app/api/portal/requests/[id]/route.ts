/**
 * /api/portal/requests/[id] — Wedding Workspace Request Detail.
 * GET  ?token=...                                  → detail + history (auto-marks Sent → Viewed)
 * POST { token, responseText?, responseFileUrl? }  → the one client-side action for every
 *   request type (Requirement 4) — submit information, record an upload's URL, an
 *   approval/rejection decision, a confirmation, a selection, or a Task "mark complete".
 */
import { NextResponse } from "next/server";
import { getPortalRequestDetail, submitPortalRequest } from "@/lib/requests/portal";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const detail = await getPortalRequestDetail(token, id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ request: detail });
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params;
  const body = await request.json() as { token?: string; responseText?: string; responseFileUrl?: string };
  const { token, responseText, responseFileUrl } = body;
  if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

  const result = await submitPortalRequest(token, id, responseText ?? null, responseFileUrl ?? null);
  return NextResponse.json(result);
}
