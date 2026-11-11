/**
 * POST /api/portal/luv-ask
 *
 * Couple asks Luv a question.
 * Knowledge layers:
 *   1. HTC product knowledge — couple-safe Help article projections
 *   2. Venue Guide — published client-facing venue information
 *   3. Portal context — this couple's payments / contracts / documents (Phase 2A)
 *
 * Luv Intelligence V1: structured outcome + information-gap next steps + signal persistence.
 *
 * Body:     { token: string; question: string }
 * Response: { answer, guideSection, outcome, nextSteps } | { error }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { isOpenAiConfigured, openAiChatCompletion } from "@/lib/ai/openai";
import {
  checkLuvAskRateLimit,
  isLuvAskQuestionTooLong,
  luvAskClientIp,
} from "@/lib/luv/ask-guard";
import {
  parseLuvAskModelResponse,
  unavailableAskResponse,
  type LuvAskNextStepType,
  type LuvAskOutcome,
} from "@/lib/luv/ask-outcome";
import { recordLuvAskSignal } from "@/lib/luv/ask-signals";
import { buildCoupleAskLuvSystemPrompt } from "@/lib/luv/couple-ask-prompt";
import { retrieveCoupleHtcKnowledge } from "@/lib/luv/couple-htc-knowledge";
import { loadLuvAskPortalContext } from "@/lib/luv/portal-context/load";
import {
  getLuvSettingsForVenueId,
  isLuvDraftingEnabled,
  luvAskVoiceInstruction,
} from "@/lib/luv/settings";
import {
  projectGuideForAudience,
  type VenueGuideRaw,
} from "@/lib/venue-guide/audience";

type AskJsonBody = {
  answer: string;
  guideSection: string | null;
  outcome: LuvAskOutcome;
  nextSteps: LuvAskNextStepType[];
};

function askJson(body: AskJsonBody, status = 200) {
  return NextResponse.json(body, { status });
}

async function respondAndSignal(
  token: string,
  question: string,
  body: AskJsonBody,
  status = 200,
) {
  // Fire-and-forget persistence — never block or fail the client response.
  void recordLuvAskSignal({
    token,
    question,
    outcome: body.outcome,
    guideSection: body.guideSection,
    nextSteps: body.nextSteps,
  });
  return askJson(body, status);
}

export async function POST(request: Request) {
  let body: { token?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { token, question } = body;
  if (!token || !question?.trim()) {
    return NextResponse.json({ error: "missing_token_or_question" }, { status: 400 });
  }

  const trimmedQuestion = question.trim();

  if (isLuvAskQuestionTooLong(question)) {
    return respondAndSignal(
      token,
      trimmedQuestion,
      unavailableAskResponse("That's a bit too long — try a shorter question."),
      400,
    );
  }

  const rate = checkLuvAskRateLimit({ token, ip: luvAskClientIp(request) });
  if (!rate.allowed) {
    return respondAndSignal(
      token,
      trimmedQuestion,
      unavailableAskResponse("Luv needs a short break — please try again in a few minutes."),
      429,
    );
  }

  const supabase = await createClient();

  const { data: venueInfo, error: infoErr } = await supabase.rpc("get_venue_info_for_portal", {
    p_token: token,
  });
  if (infoErr) return NextResponse.json({ error: infoErr.message }, { status: 500 });

  const projected = projectGuideForAudience(
    (venueInfo ?? null) as VenueGuideRaw | null,
    "clients",
  );

  const { data: portalCtx } = await supabase.rpc("get_portal_context", { p_token: token });
  const venueId = (portalCtx as { venue?: { id?: string } } | null)?.venue?.id;
  if (!venueId) {
    return respondAndSignal(
      token,
      trimmedQuestion,
      unavailableAskResponse(
        "Luv isn't configured yet — ask your venue coordinator directly.",
      ),
    );
  }

  const settings = await getLuvSettingsForVenueId(venueId);
  if (!isLuvDraftingEnabled(settings)) {
    return respondAndSignal(
      token,
      trimmedQuestion,
      unavailableAskResponse(
        "Luv isn't available right now — ask your venue coordinator directly.",
      ),
    );
  }

  if (!isOpenAiConfigured()) {
    return respondAndSignal(
      token,
      trimmedQuestion,
      unavailableAskResponse(
        "Luv isn't available right now — ask your venue coordinator directly.",
      ),
    );
  }

  const venueName = "your venue";
  const htcHits = retrieveCoupleHtcKnowledge(trimmedQuestion);

  let portalContext = null;
  try {
    portalContext = await loadLuvAskPortalContext(token);
  } catch (err) {
    console.error("luv-ask portal context load failed:", err);
  }

  const importantContacts = (projected?.importantContacts ?? []) as {
    name: string;
    role: string;
    phone?: string;
    email?: string;
  }[];
  const hasPublishedContacts = importantContacts.some(
    (c) => c && typeof c.name === "string" && c.name.trim().length > 0,
  );

  const systemPrompt = buildCoupleAskLuvSystemPrompt({
    venueName,
    voiceInstruction: luvAskVoiceInstruction(settings.preferredTone),
    htcHits,
    venueInfo: {
      parkingInfo: projected?.parkingInfo ?? null,
      transportation: projected?.transportation ?? null,
      faqs: projected?.faqs ?? [],
      policies: projected?.policies ?? null,
      ceremonyInstructions: projected?.ceremonyInstructions ?? null,
      rainPlan: projected?.rainPlan ?? null,
      nearbyAccommodations: projected?.nearbyAccommodations ?? null,
      thingsToDo: projected?.thingsToDo ?? null,
      importantContacts,
      hotelBlocks: (projected?.hotelBlocks ?? []) as {
        name: string;
        url?: string;
        code?: string;
        notes?: string;
      }[],
    },
    portalContext,
  });

  try {
    const raw = await openAiChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question from the couple: "${trimmedQuestion}"` },
      ],
      maxCompletionTokens: 600,
      timeoutMs: 25_000,
    });
    const parsed = parseLuvAskModelResponse(raw, { hasPublishedContacts });

    return respondAndSignal(token, trimmedQuestion, {
      answer: parsed.answer,
      guideSection: parsed.guideSection,
      outcome: parsed.outcome,
      nextSteps: parsed.nextSteps,
    });
  } catch (err) {
    console.error("luv-ask error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("OpenAI API error")) {
      return respondAndSignal(
        token,
        trimmedQuestion,
        unavailableAskResponse(
          "Luv had trouble answering that right now. Try asking your venue coordinator directly.",
        ),
      );
    }
    return respondAndSignal(
      token,
      trimmedQuestion,
      unavailableAskResponse("Luv couldn't connect right now. Please try again."),
    );
  }
}
