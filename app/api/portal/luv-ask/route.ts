/**
 * POST /api/portal/luv-ask
 *
 * Couple asks Luv a question.
 * Knowledge layers (Phase 1):
 *   1. HTC product knowledge — couple-safe Help article projections
 *   2. Venue Guide — what this venue provided
 * Portal facts are intentionally not included yet (Phase 2 extension point).
 *
 * Body:     { token: string; question: string }
 * Response: { answer: string; guideSection?: string | null } | { error: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { isOpenAiConfigured, openAiChatCompletion } from "@/lib/ai/openai";
import {
  checkLuvAskRateLimit,
  isLuvAskQuestionTooLong,
  luvAskClientIp,
} from "@/lib/luv/ask-guard";
import { buildCoupleAskLuvSystemPrompt } from "@/lib/luv/couple-ask-prompt";
import { retrieveCoupleHtcKnowledge } from "@/lib/luv/couple-htc-knowledge";
import {
  getLuvSettingsForVenueId,
  isLuvDraftingEnabled,
  luvAskVoiceInstruction,
} from "@/lib/luv/settings";
import {
  projectGuideForAudience,
  type VenueGuideRaw,
} from "@/lib/venue-guide/audience";

// Map our guide section keys to their UI labels — must match venue-guide-section.tsx
const GUIDE_SECTION_LABELS: Record<string, string> = {
  parking:        "Parking & Transportation",
  accommodations: "Accommodations",
  weather:        "Weather & Rain Plan",
  policies:       "Policies & Rules",
  ceremony:       "Ceremony & Arrival",
  things_to_know: "Things To Know",
  faqs:           "FAQs",
  contacts:       "Important Contacts",
};

function parseAskJson(raw: string): { answer: string; guideSection: string | null } {
  // Strip markdown fences the model might add despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { answer?: unknown; guideSection?: unknown };
    const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
    const guideSection = typeof parsed.guideSection === "string" && parsed.guideSection in GUIDE_SECTION_LABELS
      ? parsed.guideSection
      : null;
    return { answer: answer || raw.trim(), guideSection };
  } catch {
    return { answer: raw.trim(), guideSection: null };
  }
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

  if (isLuvAskQuestionTooLong(question)) {
    return NextResponse.json({
      answer: "That's a bit too long — try a shorter question.",
      guideSection: null,
    }, { status: 400 });
  }

  const rate = checkLuvAskRateLimit({ token, ip: luvAskClientIp(request) });
  if (!rate.allowed) {
    return NextResponse.json({
      answer: "Luv needs a short break — please try again in a few minutes.",
      guideSection: null,
    }, { status: 429 });
  }

  const supabase = await createClient();

  const { data: venueInfo, error: infoErr } = await supabase.rpc("get_venue_info_for_portal", { p_token: token });
  if (infoErr) return NextResponse.json({ error: infoErr.message }, { status: 500 });

  // get_venue_info_for_portal returns camelCase keys (no nested venue_name).
  const projected = projectGuideForAudience(
    (venueInfo ?? null) as VenueGuideRaw | null,
    "clients",
  );

  const { data: portalCtx } = await supabase.rpc("get_portal_context", { p_token: token });
  const venueId = (portalCtx as { venue?: { id?: string } } | null)?.venue?.id;
  if (!venueId) {
    return NextResponse.json({
      answer: "Luv isn't configured yet — ask your venue coordinator directly.",
      guideSection: null,
    });
  }

  const settings = await getLuvSettingsForVenueId(venueId);
  if (!isLuvDraftingEnabled(settings)) {
    return NextResponse.json({
      answer: "Luv isn't available right now — ask your venue coordinator directly.",
      guideSection: null,
    });
  }

  const apiKeyConfigured = isOpenAiConfigured();
  if (!apiKeyConfigured) {
    return NextResponse.json({
      answer: "Luv isn't available right now — ask your venue coordinator directly.",
      guideSection: null,
    });
  }

  const venueName = "your venue";
  const trimmedQuestion = question.trim();
  const htcHits = retrieveCoupleHtcKnowledge(trimmedQuestion);

  const systemPrompt = buildCoupleAskLuvSystemPrompt({
    venueName,
    voiceInstruction: luvAskVoiceInstruction(settings.preferredTone),
    htcHits,
    venueInfo: {
      parkingInfo:          projected?.parkingInfo ?? null,
      transportation:       projected?.transportation ?? null,
      faqs:                 projected?.faqs ?? [],
      policies:             projected?.policies ?? null,
      ceremonyInstructions: projected?.ceremonyInstructions ?? null,
      rainPlan:             projected?.rainPlan ?? null,
      nearbyAccommodations: projected?.nearbyAccommodations ?? null,
      thingsToDo:           projected?.thingsToDo ?? null,
      importantContacts:    (projected?.importantContacts ?? []) as {
        name: string; role: string; phone?: string; email?: string;
      }[],
      hotelBlocks:          (projected?.hotelBlocks ?? []) as {
        name: string; url?: string; code?: string; notes?: string;
      }[],
    },
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
    const { answer, guideSection } = parseAskJson(raw);

    return NextResponse.json({ answer, guideSection });
  } catch (err) {
    console.error("luv-ask error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("OpenAI API error")) {
      return NextResponse.json({
        answer: "Luv had trouble answering that right now. Try asking your venue coordinator directly.",
        guideSection: null,
      });
    }
    return NextResponse.json({
      answer: "Luv couldn't connect right now. Please try again.",
      guideSection: null,
    });
  }
}
