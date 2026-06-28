/**
 * POST /api/public/questionnaire
 *
 * Handles couple questionnaire submission. No auth required.
 * Calls submit_questionnaire_as_couple() SECURITY DEFINER function.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 }); }

  const { accessKey, finalGuestCount, mealNotes, processionalSong, recessionalSong,
    firstDanceSong, parentDances, emergencyContactName, emergencyContactPhone, specialRequests } = body;

  if (!accessKey) return NextResponse.json({ ok: false, message: "Missing access key." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_questionnaire_as_couple", {
    p_key:                   String(accessKey),
    p_final_guest_count:     finalGuestCount ? Number(finalGuestCount) : null,
    p_meal_notes:            mealNotes ? String(mealNotes) : "",
    p_processional_song:     processionalSong ? String(processionalSong) : "",
    p_recessional_song:      recessionalSong ? String(recessionalSong) : "",
    p_first_dance_song:      firstDanceSong ? String(firstDanceSong) : "",
    p_parent_dances:         parentDances ? String(parentDances) : "",
    p_emergency_contact:     emergencyContactName ? String(emergencyContactName) : "",
    p_emergency_phone:       emergencyContactPhone ? String(emergencyContactPhone) : "",
    p_special_requests:      specialRequests ? String(specialRequests) : "",
  });

  if (error || !data?.ok) {
    return NextResponse.json({ ok: false, message: data?.error ?? "Could not submit." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
