import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: Request) {
  const body = await request.json() as {
    token: string;
    id?: string;
    name: string;
    amount: number;
  };
  const { token, id, name, amount } = body;

  if (!token || !name?.trim() || typeof amount !== "number") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("upsert_portal_contributor", {
    p_token: token,
    p_id: id ?? null,
    p_name: name.trim(),
    p_amount: amount,
  });

  if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ contributorId: data?.contributorId });
}

export async function DELETE(request: Request) {
  const body = await request.json() as { token: string; contributorId: string };
  const { token, contributorId } = body;

  if (!token || !contributorId) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createClient();
  await supabase.rpc("delete_portal_contributor", {
    p_token: token,
    p_id: contributorId,
  });

  return NextResponse.json({ ok: true });
}
