import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
import { triggerAutoComplete } from "@/lib/playbooks/service";

/**
 * POST /api/portal/choices/submit — client submission.
 * Does NOT mutate Event Order or invoice. Venue Finalize is the apply boundary.
 * Required choice groups are validated here and again inside submit_client_choices.
 */
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

  // Defense-in-depth before RPC: load frozen definition and reject incomplete answers.
  const { data: portalPayload } = await supabase.rpc("get_client_choices_for_portal", {
    p_token: body.token,
  });
  const portalChoices = ((portalPayload as { choices?: Array<{ id: string; definition?: ChoicesDefinition }> } | null)?.choices)
    ?? [];
  const target = portalChoices.find((c) => c.id === body.choicesId);
  if (target?.definition) {
    const validated = validateChoicesAnswers(target.definition, body.answers ?? {});
    if (!validated.ok) {
      return NextResponse.json({ ok: false, message: validated.message }, { status: 400 });
    }
  }

  const { data, error } = await supabase.rpc("submit_client_choices", {
    p_token: body.token,
    p_choices_id: body.choicesId,
    p_answers: body.answers ?? null,
  });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const result = (data ?? {}) as { ok?: boolean; message?: string };
  if (result.ok) {
    try {
      const admin = createAdminClient();
      const { data: ids } = await admin.rpc("_resolve_portal_ids", { p_token: body.token });
      const row = Array.isArray(ids) ? ids[0] : ids;
      const venueId = (row as { venue_id?: string } | null)?.venue_id;
      const eventId = (row as { event_id?: string } | null)?.event_id;
      if (venueId && eventId) {
        await triggerAutoComplete(
          admin as never,
          venueId,
          eventId,
          "client_choices_submitted",
          "client_choices",
          body.choicesId,
        );
      }
    } catch {
      // Task auto-complete is best-effort; submission already persisted.
    }
  }

  return NextResponse.json(data ?? { ok: false });
}
