import {
  luvToneInstruction,
  normalizePreferredTone,
  type LuvSettings,
} from "@/lib/luv/settings";

export function buildDashboardDraftSystemPrompt(
  venueName: string,
  preferredTone: LuvSettings["preferredTone"] | string | null | undefined,
): string {
  const toneInstruction = luvToneInstruction(preferredTone);
  return `You are Luv, the built-in AI assistant for ${venueName}, a wedding venue. Write content on behalf of the venue team. Follow this writing-tone preference for style only (do not invent facts to match a tone): ${toneInstruction} Begin your response immediately with the first section header — no preamble, no sign-off. Use [Couple Name], [Coordinator Name], [Their Wedding Date or Season], and [Venue Name] as placeholders where relevant.`;
}

export function buildDashboardDraftPrompt(
  action: string,
  context: Record<string, unknown>,
  venueName: string,
  preferredTone: LuvSettings["preferredTone"] | string | null | undefined,
): string {
  const tone = normalizePreferredTone(preferredTone);
  switch (action) {

    case "follow_up_messages": {
      const count = context.staleLeadCount ?? "several";
      return `${count} couple${Number(count) !== 1 ? "s" : ""} at ${venueName} haven't been contacted in over a week. Draft a follow-up package they can personalize and send.

Writing tone (required): ${luvToneInstruction(tone)}

Format your response with exactly these section headers, in this order:

## Subject Line
## Email
## Text Message

Subject line: punchy, under 10 words, matching the writing tone.
Email body: under 120 words, genuine and helpful — not pushy. No greeting or sign-off, the coordinator will add those.
Text message: under 50 words, concise and appropriate for SMS.`;
    }

    case "seasonal_promo": {
      return `Inquiry volume at ${venueName} is running below average this month. Draft a complete promotion package to attract new couples.

Writing tone (required): ${luvToneInstruction(tone)}

Format your response with exactly these section headers, in this order:

## Promotion Concept
## Email
## Social Caption
## Recommended Offer

Promotion concept: 1–2 sentences describing the angle or hook.
Email: under 100 words. Inviting, not salesy.
Social caption: under 60 words. Conversational and Instagram-ready, matching the writing tone.
Recommended offer: a specific, generous-feeling offer (discount, bonus, perk). One sentence.`;
    }

    case "availability_plan": {
      const month = context.nextMonthName ?? "next month";
      const ratio = context.nextRatio
        ? `${Math.round((Number(context.nextRatio) - 1) * 100)}% above average`
        : "significantly above average";
      return `${month} at ${venueName} is historically ${ratio} for inquiries. Help them prepare.

Writing tone (required): ${luvToneInstruction(tone)}

Format your response with exactly these section headers, in this order:

## Suggested Open Dates
## Staffing Reminders
## Package Recommendations

Suggested open dates: specific practical advice on which weekends/dates to prioritize opening, under 80 words.
Staffing reminders: 2–3 concrete staffing or prep actions to take before peak season, under 80 words.
Package recommendations: 2–3 specific package or offering suggestions that tend to perform well during high-demand periods, under 80 words.`;
    }

    default:
      return `Write a short message on behalf of ${venueName} to help them connect with prospective couples. Under 80 words.

Writing tone (required): ${luvToneInstruction(tone)}`;
  }
}
