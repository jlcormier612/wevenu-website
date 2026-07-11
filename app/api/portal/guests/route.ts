import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// RSVP update route lives at /api/portal/guests/rsvp — handled inline below via method routing

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_couple_guests", { p_token: token });
  return NextResponse.json(data ?? { guests: [], stats: {} });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    token: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    plusOne?: boolean;
    plusOneName?: string;
    householdId?: string | null;
    dietary?: string;
    isChild?: boolean;
    guests?: { firstName: string; lastName?: string; email?: string; household?: string }[];
  };
  const { token } = body;
  if (!token) return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });
  const supabase = await createClient();

  // Batch import (CSV)
  if (body.guests?.length) {
    const { data } = await supabase.rpc("batch_add_couple_guests", { p_token: token, p_guests: body.guests });
    return NextResponse.json(data ?? { ok: false });
  }

  // Single add
  if (!body.firstName) return NextResponse.json({ ok: false, error: "Missing firstName." }, { status: 400 });
  const { data } = await supabase.rpc("add_couple_guest", {
    p_token:          token,
    p_first_name:     body.firstName,
    p_last_name:      body.lastName ?? "",
    p_email:          body.email ?? "",
    p_phone:          body.phone ?? "",
    p_plus_one:       body.plusOne ?? false,
    p_plus_one_name:  body.plusOneName ?? "",
    p_household_id:   body.householdId ?? null,
    p_dietary:        body.dietary ?? "",
    p_is_child:       body.isChild ?? false,
  });
  if ((data as { ok?: boolean })?.ok) {
    void supabase.rpc("log_couple_event", { p_token: token, p_type: "guests_added", p_data: { count: 1 } });
  }
  return NextResponse.json(data ?? { ok: false });
}

export async function PATCH(request: Request) {
  const body = await request.json() as {
    token: string; guestId?: string;
    // RSVP-status update (existing behavior, unchanged)
    rsvpStatus?: string; rsvpNote?: string;
    // Basic editing (Guest & Household Foundation) — any other field means a full edit
    firstName?: string; lastName?: string; email?: string; phone?: string;
    plusOne?: boolean; plusOneName?: string; householdId?: string | null;
    dietary?: string; isChild?: boolean; notes?: string;
    // Invitation lifecycle (Guest Experience — Phase 2) — bulk-capable, a
    // single guest is just an array of one. Same shape for one guest or a
    // whole household's worth.
    guestIds?: string[]; invitationStatus?: string;
  };
  const { token, guestId } = body;
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();

  if (body.guestIds?.length && body.invitationStatus) {
    const { data } = await supabase.rpc("set_guest_invitation_status", {
      p_token: token, p_guest_ids: body.guestIds, p_status: body.invitationStatus,
    });
    return NextResponse.json(data ?? { ok: false });
  }

  if (!guestId) return NextResponse.json({ ok: false }, { status: 400 });

  if (body.rsvpStatus) {
    const { data } = await supabase.rpc("update_guest_rsvp", { p_token: token, p_guest_id: guestId, p_status: body.rsvpStatus, p_note: body.rsvpNote ?? "" });
    if ((data as { ok?: boolean })?.ok) {
      void supabase.rpc("log_couple_event", { p_token: token, p_type: "rsvp_updated", p_data: { guestId, status: body.rsvpStatus } });
    }
    return NextResponse.json(data ?? { ok: false });
  }

  if (!body.firstName) return NextResponse.json({ ok: false, error: "Missing firstName." }, { status: 400 });
  const { data } = await supabase.rpc("update_couple_guest", {
    p_token:          token,
    p_guest_id:       guestId,
    p_first_name:     body.firstName,
    p_last_name:      body.lastName ?? "",
    p_email:          body.email ?? "",
    p_phone:          body.phone ?? "",
    p_plus_one:       body.plusOne ?? false,
    p_plus_one_name:  body.plusOneName ?? "",
    p_household_id:   body.householdId ?? null,
    p_dietary:        body.dietary ?? "",
    p_is_child:       body.isChild ?? false,
    p_notes:          body.notes ?? "",
  });
  return NextResponse.json(data ?? { ok: false });
}

export async function DELETE(request: Request) {
  const { token, guestId } = await request.json() as { token: string; guestId: string };
  if (!token || !guestId) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("delete_couple_guest", { p_token: token, p_guest_id: guestId });
  return NextResponse.json(data ?? { ok: false });
}
