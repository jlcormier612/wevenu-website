import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_couple_guests", { p_token: token });
  return NextResponse.json(data ?? { guests: [], stats: {} });
}

export async function POST(request: Request) {
  const { token, firstName, lastName, email, plusOne, groupLabel, dietary } =
    await request.json() as { token: string; firstName: string; lastName?: string; email?: string; plusOne?: boolean; groupLabel?: string; dietary?: string };
  if (!token || !firstName) return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("add_couple_guest", {
    p_token: token, p_first_name: firstName, p_last_name: lastName ?? "",
    p_email: email ?? "", p_plus_one: plusOne ?? false,
    p_group_label: groupLabel ?? "", p_dietary: dietary ?? "",
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
