import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { reconcileAnswersForDependencies } from "@/lib/client-choices/conditional-groups";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";

/** POST /api/portal/choices/save — save working answers (not a charge). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    token?: string;
    choicesId?: string;
    answers?: ChoicesAnswers;
  };
  if (!body.token || !body.choicesId) {
    return NextResponse.json({ ok: false, message: "Missing token or choices id." }, { status: 400 });
  }
  const supabase = await createClient();

  let answers = body.answers ?? {};
  const { data: portalPayload } = await supabase.rpc("get_client_choices_for_portal", {
    p_token: body.token,
  });
  const portalChoices = ((portalPayload as { choices?: Array<{ id: string; definition?: ChoicesDefinition }> } | null)?.choices)
    ?? [];
  const target = portalChoices.find((c) => c.id === body.choicesId);
  if (target?.definition) {
    answers = reconcileAnswersForDependencies(target.definition, answers);
  }

  const { data, error } = await supabase.rpc("save_client_choices_answers", {
    p_token: body.token,
    p_choices_id: body.choicesId,
    p_answers: answers,
  });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true });
}
