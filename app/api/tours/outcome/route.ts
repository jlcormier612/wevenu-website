import { NextResponse } from "next/server";
import { updateTourOutcome } from "@/lib/tours/service";

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { appointmentId?: string; outcome?: string | null; notes?: string | null; followUpSentAt?: string | null };
    if (!body.appointmentId) return NextResponse.json({ ok: false, error: "Missing appointmentId." }, { status: 400 });
    const result = await updateTourOutcome(body.appointmentId, {
      outcome: body.outcome,
      notes: body.notes,
      followUpSentAt: body.followUpSentAt,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
