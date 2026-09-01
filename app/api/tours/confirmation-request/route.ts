import { NextResponse } from "next/server";
import { requestTourConfirmation } from "@/lib/tours/service";

export async function POST(request: Request) {
  try {
    const { appointmentId } = await request.json() as { appointmentId?: string };
    if (!appointmentId) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    const result = await requestTourConfirmation(appointmentId);
    if (!result.ok) return NextResponse.json(result, { status: result.error === "Session expired." ? 401 : 422 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
