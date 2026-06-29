import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: Request) {
  const { rsvpToken, status, plusOne, plusOneName, dietary, note } =
    await request.json() as { rsvpToken?: string; status?: string; plusOne?: boolean; plusOneName?: string; dietary?: string; note?: string };
  if (!rsvpToken || !status) return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_rsvp", {
    p_rsvp_token: rsvpToken, p_status: status,
    p_plus_one: plusOne ?? false, p_plus_one_name: plusOneName ?? null,
    p_dietary: dietary ?? null, p_note: note ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
  return NextResponse.json(data ?? { ok: false });
}
