import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { token, tableId, tableType, name, capacity, positionX, positionY, displayOrder } = body;
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_seating_table", {
    p_token:         token,
    p_table_id:      tableId ?? null,
    p_table_type:    tableType ?? "round",
    p_name:          name ?? null,
    p_capacity:      capacity ?? 8,
    p_position_x:    positionX ?? 100,
    p_position_y:    positionY ?? 100,
    p_display_order: displayOrder ?? 0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tableId: data });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const { token, tableId } = body;
  if (!token || !tableId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_seating_table", {
    p_token:    token,
    p_table_id: tableId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: data });
}
