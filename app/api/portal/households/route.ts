import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Households (Guest & Household Foundation) — the couple's own organizational
 * units for their guest list. Portal-token-scoped, same pattern as /guests.
 */

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_couple_households", { p_token: token });
  return NextResponse.json(data ?? { households: [] });
}

export async function POST(request: Request) {
  const body = await request.json() as { token: string; id?: string | null; name: string; notes?: string };
  if (!body.token || !body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("upsert_couple_household", {
    p_token: body.token,
    p_id:    body.id ?? null,
    p_name:  body.name,
    p_notes: body.notes ?? null,
  });
  return NextResponse.json(data ?? { ok: false });
}

export async function DELETE(request: Request) {
  const { token, householdId } = await request.json() as { token: string; householdId: string };
  if (!token || !householdId) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("delete_couple_household", { p_token: token, p_household_id: householdId });
  return NextResponse.json(data ?? { ok: false });
}
