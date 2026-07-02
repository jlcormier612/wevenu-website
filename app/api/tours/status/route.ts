import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import { runPostTourAutomation } from "@/lib/tours/post-tour";

const STATUS_TO_SIGNAL: Record<string, string> = {
  completed: "tour_attended",
  cancelled:  "tour_cancelled",
  no_show:    "tour_cancelled",
};

const VALID_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;
const POST_TOUR_STATUSES = new Set(["completed", "no_show", "cancelled"]);

export async function PATCH(request: Request) {
  try {
    const { appointmentId, status } = await request.json() as { appointmentId?: string; status?: string };
    if (!appointmentId || !status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }
    const venue = await getCurrentVenue();
    if (!venue) return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
    const supabase = await createClient();

    // Fetch current appointment to detect status transition
    const { data: appt } = await supabase
      .from("tour_appointments")
      .select("status, lead_id, contact_name, scheduled_at")
      .eq("id", appointmentId)
      .eq("venue_id", venue.id)
      .maybeSingle<{ status: string; lead_id: string | null; contact_name: string | null; scheduled_at: string }>();

    if (!appt) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("tour_appointments") as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .eq("venue_id", venue.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 422 });

    // Cancel pending reminders on cancel/no_show
    if (status === "cancelled" || status === "no_show") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("task_reminders") as any)
        .update({ status: "cancelled" })
        .eq("tour_appointment_id", appointmentId)
        .eq("status", "pending");
    }

    // Post-tour automation + analytics — fire-and-forget, non-blocking
    if (POST_TOUR_STATUSES.has(status) && appt.status !== status) {
      void runPostTourAutomation(
        { supabase, appointmentId, venueId: venue.id, leadId: appt.lead_id, contactName: appt.contact_name, scheduledAt: appt.scheduled_at },
        status,
      ).catch((err) => console.error("[post-tour]", err));

      // Track conversion signal
      const signalType = STATUS_TO_SIGNAL[status];
      if (signalType && appt.lead_id) {
        void supabase.from("lead_signal_events").insert({
          venue_id: venue.id,
          lead_id: appt.lead_id,
          signal_type: signalType,
          signal_strength: status === "completed" ? 3 : 1,
          metadata: { appointment_id: appointmentId, status },
        }).then(null, () => {});
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error." }, { status: 500 });
  }
}
