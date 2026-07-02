import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_rsvp_questions", { p_token: token });
  if (error) return NextResponse.json({ questions: [] });
  return NextResponse.json(data ?? { questions: [] });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    token: string;
    id?: string;
    questionKey: string;
    questionText: string;
    inputType?: string;
    options?: string[];
    appliesToPlusOne?: boolean;
    isRequired?: boolean;
    displayOrder?: number;
  };
  const { token, questionKey, questionText } = body;
  if (!token || !questionKey || !questionText) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_rsvp_question", {
    p_token:         token,
    p_id:            body.id ?? null,
    p_question_key:  questionKey,
    p_question_text: questionText,
    p_input_type:    body.inputType ?? "text",
    p_options:       body.options ? JSON.stringify(body.options) : null,
    p_applies_plus:  body.appliesToPlusOne ?? false,
    p_is_required:   body.isRequired ?? false,
    p_display_order: body.displayOrder ?? 0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ questionId: data?.questionId });
}

export async function DELETE(request: Request) {
  const body = await request.json() as { token: string; questionId: string };
  const { token, questionId } = body;
  if (!token || !questionId) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_rsvp_question", { p_token: token, p_id: questionId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
