/**
 * /api/portal/participants
 *
 * Couple-managed collaborators. The couple controls who is in their
 * planning workspace — the venue has read-only visibility, not control.
 *
 * GET    ?token=...       → list participants + activity feed
 * POST   { token, ... }  → invite a new participant
 * PATCH  { token, ... }  → update role / permissions / notifications
 * DELETE { token, ... }  → remove (revoke) a participant
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_couple_participants", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { participants: [], activity: [] });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    token: string;
    email: string;
    firstName: string;
    lastName?: string;
    role?: string;
    customRoleLabel?: string;
    permissionLevel?: string;
  };

  const { token, email, firstName, lastName, role, customRoleLabel, permissionLevel } = body;
  if (!token || !email?.trim() || !firstName?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_couple_participant", {
    p_token:            token,
    p_email:            email.trim(),
    p_first_name:       firstName.trim(),
    p_last_name:        lastName ?? "",
    p_role:             role ?? "friend",
    p_custom_label:     customRoleLabel ?? "",
    p_permission_level: permissionLevel ?? "planning",
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false, error: "Unknown error." });
}

export async function PATCH(request: Request) {
  const body = await request.json() as {
    token: string;
    participantId: string;
    role?: string;
    customRoleLabel?: string;
    permissionLevel?: string;
    notifyPlanning?: boolean;
    notifyPayments?: boolean;
    notifyWebsite?: boolean;
    notifyRsvps?: boolean;
  };

  const { token, participantId, role, customRoleLabel, permissionLevel,
          notifyPlanning, notifyPayments, notifyWebsite, notifyRsvps } = body;
  if (!token || !participantId) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_couple_participant", {
    p_token:            token,
    p_participant_id:   participantId,
    p_role:             role ?? null,
    p_custom_label:     customRoleLabel ?? null,
    p_permission_level: permissionLevel ?? null,
    p_notify_planning:  notifyPlanning ?? null,
    p_notify_payments:  notifyPayments ?? null,
    p_notify_website:   notifyWebsite ?? null,
    p_notify_rsvps:     notifyRsvps ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}

export async function DELETE(request: Request) {
  const body = await request.json() as { token: string; participantId: string };
  const { token, participantId } = body;
  if (!token || !participantId) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_couple_participant", {
    p_token:          token,
    p_participant_id: participantId,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
