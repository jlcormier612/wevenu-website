import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: Request) {
  const { token, guestId, tableId } = await request.json();
  if (!token || !guestId || !tableId)
    return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_guest_to_table", {
    p_token:    token,
    p_guest_id: guestId,
    p_table_id: tableId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: data });
}

export async function DELETE(request: Request) {
  const { token, guestId } = await request.json();
  if (!token || !guestId)
    return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_guest_assignment", {
    p_token:    token,
    p_guest_id: guestId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: data });
}
