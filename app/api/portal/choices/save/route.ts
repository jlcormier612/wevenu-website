import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/** POST /api/portal/choices/save — save working answers (not a charge). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    token?: string;
    choicesId?: string;
    answers?: unknown;
  };
  if (!body.token || !body.choicesId) {
    return NextResponse.json({ ok: false, message: "Missing token or choices id." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_client_choices_answers", {
    p_token: body.token,
    p_choices_id: body.choicesId,
    p_answers: body.answers ?? {},
  });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true });
}
