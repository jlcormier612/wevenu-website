import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

const VALID_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;

export async function PATCH(request: Request) {
  try {
    const { appointmentId, status } = await request.json() as { appointmentId?: string; status?: string };
    if (!appointmentId || !status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }
    const venue = await getCurrentVenue();
    if (!venue) return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("tour_appointments") as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .eq("venue_id", venue.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
    // Cancel pending reminders if tour is cancelled
    if (status === "cancelled") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("task_reminders") as any)
        .update({ status: "cancelled" })
        .eq("tour_appointment_id", appointmentId)
        .eq("status", "pending");
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
