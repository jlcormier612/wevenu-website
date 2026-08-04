import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { markAssignmentBooked } from "@/lib/vendor-availability/sync";
import { notifyVendorOfEventAssignment } from "@/lib/vendors/notify-assignment";
import { createAdminClient } from "@/integrations/supabase/admin";

// The couple's Commitment Lifecycle Submit event for vendor selections —
// syncs selected_at to match picks, snapshots the shortlist, auto-completes
// the "Choose your vendors" task, AND creates event_vendor_assignments
// (idempotent) so the path converges with venue Assign: conversation
// trigger + availability + vendor email notify.
export async function POST(request: Request) {
  const { token, clientId } = await request.json() as { token?: string; clientId?: string };
  if (!token || !clientId) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_vendor_list", { p_access_token: token, p_client_id: clientId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const result = (data ?? { ok: false }) as {
    ok?: boolean;
    selectedCount?: number;
    eventId?: string;
    venueId?: string;
    newlyAssigned?: Array<{ assignmentId: string; vendorId: string }> | string | null;
  };

  const newlyAssigned = Array.isArray(result.newlyAssigned)
    ? result.newlyAssigned
    : typeof result.newlyAssigned === "string"
      ? (JSON.parse(result.newlyAssigned) as Array<{ assignmentId: string; vendorId: string }>)
      : [];

  if (result.ok && result.eventId && result.venueId && newlyAssigned.length > 0) {
    let venueName = "Your venue";
    let eventName = "your event";
    let eventDate: string | null = null;
    let eventEndDate: string | null = null;
    let eventStatus = "confirmed";
    try {
      const admin = createAdminClient();
      const [{ data: venue }, { data: event }] = await Promise.all([
        admin.from("venues").select("name").eq("id", result.venueId).maybeSingle<{ name: string }>(),
        admin
          .from("events")
          .select("name, event_date, event_end_date, status")
          .eq("id", result.eventId)
          .maybeSingle<{
            name: string;
            event_date: string | null;
            event_end_date: string | null;
            status: string;
          }>(),
      ]);
      if (venue?.name) venueName = venue.name;
      if (event?.name) eventName = event.name;
      eventDate = event?.event_date ?? null;
      eventEndDate = event?.event_end_date ?? null;
      eventStatus = event?.status ?? "confirmed";
    } catch {
      // notify still runs with defaults
    }

    for (const row of newlyAssigned) {
      void markAssignmentBooked({
        assignmentId: row.assignmentId,
        vendorId: row.vendorId,
        eventDate,
        eventEndDate,
        eventName,
        eventStatus,
      });
      notifyVendorOfEventAssignment({
        venueId: result.venueId,
        venueName,
        eventId: result.eventId,
        assignmentId: row.assignmentId,
        vendorId: row.vendorId,
      });
    }
  }

  return NextResponse.json(result);
}
