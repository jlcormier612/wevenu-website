import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    token?: string;
    name?: string;
    email?: string;
    phone?: string;
    note?: string;
  };

  const { token, name, email, phone, note } = body;

  if (!token || !name?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_couple_referral", {
    p_token: token,
    p_name:  name.trim(),
    p_email: email ?? "",
    p_phone: phone ?? "",
    p_note:  note  ?? "",
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const result = data as { ok: boolean; error?: string } | null;
  if (!result?.ok) {
    return NextResponse.json({ ok: false, error: result?.error ?? "unknown" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
