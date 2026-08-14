/**
 * POST /api/public/questionnaire/draft
 *
 * Couple autosave. Supports legacy column payload and familyPayload jsonb.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 }); }

  const accessKey = body.accessKey ? String(body.accessKey) : "";
  if (!accessKey) return NextResponse.json({ ok: false, message: "Missing access key." }, { status: 400 });

  const supabase = await createClient();
  const expectedUpdatedAt = body.expectedUpdatedAt ? String(body.expectedUpdatedAt) : null;

  if (body.familyPayload && typeof body.familyPayload === "object") {
    const { data, error } = await supabase.rpc("save_questionnaire_family_draft_as_couple", {
      p_key: accessKey,
      p_payload: body.familyPayload,
      p_expected_updated_at: expectedUpdatedAt,
    });
    if (error || !data?.ok) {
      return NextResponse.json({ ok: false, error: data?.error ?? "unknown", message: data?.message }, { status: 200 });
    }
    return NextResponse.json({ ok: true, updatedAt: (data as { updated_at?: string }).updated_at });
  }

  const { finalGuestCount, mealNotes, processionalSong, recessionalSong,
    firstDanceSong, parentDances, emergencyContactName, emergencyContactPhone, specialRequests } = body;

  const { data, error } = await supabase.rpc("save_questionnaire_draft_as_couple", {
    p_key:                   accessKey,
    p_final_guest_count:     finalGuestCount ? Number(finalGuestCount) : null,
    p_meal_notes:            mealNotes ? String(mealNotes) : "",
    p_processional_song:     processionalSong ? String(processionalSong) : "",
    p_recessional_song:      recessionalSong ? String(recessionalSong) : "",
    p_first_dance_song:      firstDanceSong ? String(firstDanceSong) : "",
    p_parent_dances:         parentDances ? String(parentDances) : "",
    p_emergency_contact:     emergencyContactName ? String(emergencyContactName) : "",
    p_emergency_phone:       emergencyContactPhone ? String(emergencyContactPhone) : "",
    p_special_requests:      specialRequests ? String(specialRequests) : "",
    p_expected_updated_at:   expectedUpdatedAt,
  });

  if (error || !data?.ok) {
    return NextResponse.json({ ok: false, error: data?.error ?? "unknown", message: data?.message }, { status: 200 });
  }
  return NextResponse.json({ ok: true, updatedAt: (data as { updated_at?: string }).updated_at });
}
