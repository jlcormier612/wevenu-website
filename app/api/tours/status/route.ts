import { NextResponse } from "next/server";
import { updateTourStatus } from "@/lib/tours/service";

const VALID_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;

export async function PATCH(request: Request) {
  try {
    const { appointmentId, status, reason } = await request.json() as { appointmentId?: string; status?: string; reason?: string };
    if (!appointmentId || !status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }
    const result = await updateTourStatus(appointmentId, status as typeof VALID_STATUSES[number], reason);
    if (!result.ok) return NextResponse.json(result, { status: result.error === "Session expired." ? 401 : 422 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
