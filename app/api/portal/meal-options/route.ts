import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * The couple's meal-selection catalog (Guest Experience — Phase 3) — the
 * one authoritative source of meal options, replacing the old rsvp_questions
 * "meal_choice" magic-key convention. Same pattern as /households.
 */

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_couple_meal_options", { p_token: token });
  return NextResponse.json(data ?? { mealOptions: [] });
}

export async function POST(request: Request) {
  const body = await request.json() as { token: string; id?: string | null; name: string; sortOrder?: number };
  if (!body.token || !body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("upsert_couple_meal_option", {
    p_token: body.token,
    p_id:    body.id ?? null,
    p_name:  body.name,
    p_sort_order: body.sortOrder ?? 0,
  });
  return NextResponse.json(data ?? { ok: false });
}

export async function DELETE(request: Request) {
  const { token, id } = await request.json() as { token: string; id: string };
  if (!token || !id) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("delete_couple_meal_option", { p_token: token, p_id: id });
  return NextResponse.json(data ?? { ok: false });
}
