import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { isOpenAiConfigured, openAiChatCompletion, OPENAI_MODEL_FAST } from "@/lib/ai/openai";
import {
  buildDashboardDraftPrompt,
  buildDashboardDraftSystemPrompt,
} from "@/lib/luv/dashboard-draft-prompt";
import { getLuvSettings, isLuvDraftingEnabled, normalizePreferredTone } from "@/lib/luv/settings";

/**
 * Non-streaming generation — same OpenAI path as lib/luv/drafts.ts.
 * Streaming previously returned a Response before provider auth failures
 * surfaced, which produced ALB 502 "failed to pipe response" instead of a
 * friendly JSON error the draft sheet can show and retry.
 */
export async function POST(request: Request) {
  const { action, context } = (await request.json()) as {
    action:  string;
    context: Record<string, unknown>;
  };

  const supabase = await createClient();
  const { data: venueData } = await supabase
    .from("venues")
    .select("name")
    .single();

  const venueName = venueData?.name ?? "your venue";
  const settings = await getLuvSettings();
  if (!isLuvDraftingEnabled(settings)) {
    return NextResponse.json(
      { error: "Luv drafting is turned off in Settings. Turn it on under Communications → Luv to generate drafts." },
      { status: 403 }
    );
  }

  if (!isOpenAiConfigured()) {
    console.error("[luv/draft] OPENAI_API_KEY is not configured");
    return NextResponse.json(
      { error: "AI drafting is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const preferredTone = normalizePreferredTone(settings.preferredTone);
  const prompt = buildDashboardDraftPrompt(action, context, venueName, preferredTone);

  try {
    const text = await openAiChatCompletion({
      model: OPENAI_MODEL_FAST,
      messages: [
        { role: "system", content: buildDashboardDraftSystemPrompt(venueName, preferredTone) },
        { role: "user", content: prompt },
      ],
      maxCompletionTokens: 800,
      timeoutMs: 25_000,
    });
    return new Response(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[luv/draft] Generation failed:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("OpenAI API error")) {
      return NextResponse.json(
        { error: "AI drafting is temporarily unavailable. Please try again later." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate draft" },
      { status: 502 }
    );
  }
}
