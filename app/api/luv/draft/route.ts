import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { getLuvSettings, isLuvDraftingEnabled, luvToneInstruction } from "@/lib/luv/settings";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = (venueName: string, toneInstruction: string) =>
  `You are Luv, the built-in AI assistant for ${venueName}, a wedding venue. Write warm, professional content on behalf of the venue team. ${toneInstruction} Begin your response immediately with the first section header — no preamble, no sign-off. Use [Couple Name], [Coordinator Name], [Their Wedding Date or Season], and [Venue Name] as placeholders where relevant.`;

function buildPrompt(action: string, context: Record<string, unknown>, venueName: string): string {
  switch (action) {

    case "follow_up_messages": {
      const count = context.staleLeadCount ?? "several";
      return `${count} couple${Number(count) !== 1 ? "s" : ""} at ${venueName} haven't been contacted in over a week. Draft a follow-up package they can personalize and send.

Format your response with exactly these section headers, in this order:

## Subject Line
## Email
## Text Message

Subject line: punchy and warm, under 10 words.
Email body: under 120 words, warm and genuine — not pushy. No greeting or sign-off, the coordinator will add those.
Text message: under 50 words, casual and friendly.`;
    }

    case "seasonal_promo": {
      return `Inquiry volume at ${venueName} is running below average this month. Draft a complete promotion package to attract new couples.

Format your response with exactly these section headers, in this order:

## Promotion Concept
## Email
## Social Caption
## Recommended Offer

Promotion concept: 1–2 sentences describing the angle or hook.
Email: under 100 words. Inviting, not salesy.
Social caption: under 60 words. Warm, conversational, Instagram-ready.
Recommended offer: a specific, generous-feeling offer (discount, bonus, perk). One sentence.`;
    }

    case "availability_plan": {
      const month = context.nextMonthName ?? "next month";
      const ratio = context.nextRatio
        ? `${Math.round((Number(context.nextRatio) - 1) * 100)}% above average`
        : "significantly above average";
      return `${month} at ${venueName} is historically ${ratio} for inquiries. Help them prepare.

Format your response with exactly these section headers, in this order:

## Suggested Open Dates
## Staffing Reminders
## Package Recommendations

Suggested open dates: specific practical advice on which weekends/dates to prioritize opening, under 80 words.
Staffing reminders: 2–3 concrete staffing or prep actions to take before peak season, under 80 words.
Package recommendations: 2–3 specific package or offering suggestions that tend to perform well during high-demand periods, under 80 words.`;
    }

    default:
      return `Write a short, warm message on behalf of ${venueName} to help them connect with prospective couples. Under 80 words.`;
  }
}

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
      { error: "AI drafting is not configured. Please contact support." },
      { status: 500 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[luv/draft] ANTHROPIC_API_KEY is not configured");
    return NextResponse.json(
      { error: "AI drafting is not configured. Please contact support." },
      { status: 500 }
    );
  }

  const prompt = buildPrompt(action, context, venueName);

  try {
    const stream = client.messages.stream(
      {
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system:     SYSTEM(venueName, luvToneInstruction(settings.preferredTone)),
        messages:   [{ role: "user", content: prompt }],
      },
      { timeout: 25_000 },
    );

    return new Response(stream.toReadableStream(), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[luv/draft] Generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate draft" },
      { status: 502 }
    );
  }
}
