/**
 * POST /api/portal/luv-ask
 *
 * Couple asks Luv a question.
 * Knowledge layers:
 *   1. HTC product knowledge — couple-safe Help article projections
 *   2. Venue Guide — published client-facing venue information
 *   3. Portal context — payments / contracts / documents + planning tasks /
 *      questionnaires / published timeline (Ask POST only — never on portal GET)
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
import {
  buildPrivacyScopedAskAnswer,
  classifyCoupleAskPrivacyScope,
  shouldShortCircuitPrivacyAsk,
} from "@/lib/luv/ask-privacy-scope";
import { formatOwnPaymentSummaryForAskPrivacy } from "@/lib/luv/portal-context/format";
import { loadLuvAskPortalContext } from "@/lib/luv/portal-context/load";
import {
  getLuvSettingsForVenueId,
  isLuvDraftingEnabled,
  isLuvEnabled,
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
  const supabase = await createClient();

  // Resolve venue from validated portal token before any Luv side effects.
  const { data: portalCtx } = await supabase.rpc("get_portal_context", { p_token: token });
  const venueId = (portalCtx as { venue?: { id?: string } } | null)?.venue?.id;
  if (!venueId) {
    return askJson(
      unavailableAskResponse(
        "Luv isn't configured yet — ask your venue coordinator directly.",
      ),
    );
  }

  // Master OFF / settings read fail-closed → friendly response, no signal, no AI.
  const settings = await getLuvSettingsForVenueId(venueId);
  if (!isLuvEnabled(settings)) {
    return askJson(
      unavailableAskResponse(
        "Luv isn't available right now — ask your venue coordinator directly.",
      ),
    );
  }

  // Abuse protections after master gate — only signal when Luv is enabled.
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

  const { data: venueInfo, error: infoErr } = await supabase.rpc("get_venue_info_for_portal", {
    p_token: token,
  });
  if (infoErr) return NextResponse.json({ error: infoErr.message }, { status: 500 });

  const projected = projectGuideForAudience(
    (venueInfo ?? null) as VenueGuideRaw | null,
    "clients",
  );

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

  const portalClient = (portalCtx as {
    client?: {
      firstName?: string | null;
      lastName?: string | null;
      partnerFirstName?: string | null;
      partnerLastName?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      partner_first_name?: string | null;
      partner_last_name?: string | null;
    };
  } | null)?.client;
  const coupleNames = [
    portalClient?.firstName,
    portalClient?.lastName,
    portalClient?.partnerFirstName,
    portalClient?.partnerLastName,
    portalClient?.first_name,
    portalClient?.last_name,
    portalClient?.partner_first_name,
    portalClient?.partner_last_name,
  ].filter((n): n is string => typeof n === "string" && n.trim().length > 0);

  const privacyScope = classifyCoupleAskPrivacyScope({
    question: trimmedQuestion,
    coupleNames,
  });

  // Deterministic privacy short-circuit: refuse unrelated-person private/financial
  // asks without volunteering THIS couple's balances (and without OpenAI).
  if (shouldShortCircuitPrivacyAsk(privacyScope)) {
    const scoped = buildPrivacyScopedAskAnswer({
      scope: privacyScope,
      ownPaymentSummary: formatOwnPaymentSummaryForAskPrivacy(portalContext),
    });
    const nextSteps =
      privacyScope.kind === "mixed_own_and_unrelated_private" && scoped.includeOwnPayments
        ? (["open_payments", "phrase_question"] as LuvAskNextStepType[])
        : (["phrase_question"] as LuvAskNextStepType[]);
    return respondAndSignal(token, trimmedQuestion, {
      answer: scoped.answer,
      guideSection: null,
      outcome:
        privacyScope.kind === "mixed_own_and_unrelated_private" && scoped.includeOwnPayments
          ? "answered_portal_context"
          : "information_gap",
      nextSteps,
    });
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
