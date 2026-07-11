import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Plus One lifecycle (Guest Experience — Phase 3). A plus-one is always a
 * real couple_guests record — this route only ever creates/removes that
 * record via the SECURITY DEFINER RPCs; it never writes a name into a text
 * field as a substitute for one.
 */

export async function POST(request: Request) {
  const body = await request.json() as {
    token: string; guestId: string; action: "assign" | "convert"; name?: string;
  };
  const { token, guestId, action } = body;
  if (!token || !guestId) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();

  if (action === "convert") {
    const { data } = await supabase.rpc("convert_plus_one_placeholder", { p_token: token, p_primary_guest_id: guestId });
    return NextResponse.json(data ?? { ok: false });
  }

  const { data } = await supabase.rpc("assign_plus_one", { p_token: token, p_primary_guest_id: guestId, p_name: body.name ?? "Guest" });
  return NextResponse.json(data ?? { ok: false });
}

export async function DELETE(request: Request) {
  const { token, guestId } = await request.json() as { token: string; guestId: string };
  if (!token || !guestId) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("remove_plus_one", { p_token: token, p_primary_guest_id: guestId });
  return NextResponse.json(data ?? { ok: false });
}
