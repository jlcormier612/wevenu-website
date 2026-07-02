import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: Request) {
  const body = await request.json() as {
    rsvpToken?: string; status?: string;
    plusOne?: boolean; plusOneName?: string; dietary?: string; note?: string;
    mealChoice?: string; plusOneMeal?: string;
    answers?: { questionId: string; answer: string }[];
    householdResponses?: { guestId: string; status: string; mealChoice?: string }[];
  };
  const { rsvpToken, status } = body;
  if (!rsvpToken || !status) return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_rsvp", {
    p_rsvp_token:          rsvpToken,
    p_status:              status,
    p_plus_one:            body.plusOne ?? false,
    p_plus_one_name:       body.plusOneName ?? null,
    p_dietary:             body.dietary ?? null,
    p_note:                body.note ?? null,
    p_meal_choice:         body.mealChoice ?? null,
    p_plus_one_meal:       body.plusOneMeal ?? null,
    p_answers:             body.answers ? JSON.stringify(body.answers) : null,
    p_household_responses: body.householdResponses ? JSON.stringify(body.householdResponses) : null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
  return NextResponse.json(data ?? { ok: false });
}
