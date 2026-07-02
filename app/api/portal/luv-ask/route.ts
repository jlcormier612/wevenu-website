/**
 * POST /api/portal/luv-ask
 *
 * Couple asks Luv a question about the venue.
 * Luv answers warmly and returns the most relevant Venue Guide section so
 * the UI can surface a "View in Venue Guide →" chip.
 *
 * Body:     { token: string; question: string }
 * Response: { answer: string; guideSection?: string | null } | { error: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

type VenueInfo = {
  venueName?: string;
  parkingInfo?: string | null;
  transportation?: string | null;
  faqs?: { question: string; answer: string }[] | null;
  policies?: string | null;
  ceremonyInstructions?: string | null;
  rainPlan?: string | null;
  nearbyAccommodations?: string | null;
  thingsToDo?: string | null;
  importantContacts?: { name: string; role: string; phone?: string; email?: string }[] | null;
  hotelBlocks?: { name: string; url?: string; code?: string; notes?: string }[] | null;
};

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

function hasContent(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function buildContext(info: VenueInfo, venueName: string): string {
  const parts: string[] = [];

  parts.push(
    `You are Luv 💗, the warm and knowledgeable wedding assistant for ${venueName}.`,
    `You help couples planning their wedding by answering questions about this venue clearly, warmly, and concisely.`,
    ``,
    `IMPORTANT — RESPONSE FORMAT:`,
    `Always respond with a single valid JSON object. Do not include markdown fences or any text outside the JSON.`,
    `Format:`,
    `{`,
    `  "answer": "Your warm, helpful answer here. One to three short paragraphs. No markdown formatting.",`,
    `  "guideSection": "<section_key> | null"`,
    `}`,
    ``,
    `GUIDE SECTION KEYS — set guideSection to the most relevant key when your answer draws from that section's info. Set null if not applicable:`,
    `  "parking"        → Parking & Transportation`,
    `  "accommodations" → Accommodations (hotels, hotel blocks)`,
    `  "weather"        → Weather & Rain Plan (rain plan, contingency)`,
    `  "policies"       → Policies & Rules (what's allowed, vendor rules, restrictions)`,
    `  "ceremony"       → Ceremony & Arrival (ceremony setup, arrival instructions)`,
    `  "things_to_know" → Things To Know (general venue tips)`,
    `  "faqs"           → FAQs`,
    `  "contacts"       → Important Contacts (coordinator, venue team)`,
    ``,
    `RULES:`,
    `- Only use the information provided below. If something isn't covered, say so honestly and suggest they ask their coordinator directly.`,
    `- Keep answers warm and personal — you're a trusted friend helping them plan, not a help desk.`,
    `- When you reference information from a specific section, set guideSection accordingly so couples can explore further.`,
    `- Never make up information about the venue.`,
    ``,
    `--- VENUE KNOWLEDGE ---`,
  );

  if (hasContent(info.policies))
    parts.push(`Policies & Rules (guideSection: "policies"):\n${info.policies}`);

  if (hasContent(info.parkingInfo) || hasContent(info.transportation)) {
    parts.push(`Parking & Transportation (guideSection: "parking"):`);
    if (hasContent(info.parkingInfo))    parts.push(info.parkingInfo!);
    if (hasContent(info.transportation)) parts.push(info.transportation!);
  }

  if (hasContent(info.ceremonyInstructions))
    parts.push(`Ceremony & Arrival (guideSection: "ceremony"):\n${info.ceremonyInstructions}`);

  if (hasContent(info.rainPlan))
    parts.push(`Weather & Rain Plan (guideSection: "weather"):\n${info.rainPlan}`);

  if (hasContent(info.nearbyAccommodations) || (info.hotelBlocks?.length)) {
    parts.push(`Accommodations (guideSection: "accommodations"):`);
    if (hasContent(info.nearbyAccommodations)) parts.push(info.nearbyAccommodations!);
    if (info.hotelBlocks?.length) {
      parts.push("Hotel Blocks:");
      for (const h of info.hotelBlocks) {
        parts.push(`- ${h.name}${h.code ? ` (booking code: ${h.code})` : ""}${h.url ? ` — ${h.url}` : ""}${h.notes ? ` — ${h.notes}` : ""}`);
      }
    }
  }

  if (hasContent(info.thingsToDo))
    parts.push(`Things To Know (guideSection: "things_to_know"):\n${info.thingsToDo}`);

  if (info.faqs?.length) {
    parts.push(`Frequently Asked Questions (guideSection: "faqs"):`);
    for (const faq of info.faqs) {
      parts.push(`Q: ${faq.question}\nA: ${faq.answer}`);
    }
  }

  if (info.importantContacts?.length) {
    parts.push(`Important Contacts (guideSection: "contacts"):`);
    for (const c of info.importantContacts) {
      parts.push(`- ${c.name} (${c.role})${c.phone ? ` — ${c.phone}` : ""}${c.email ? ` — ${c.email}` : ""}`);
    }
  }

  return parts.join("\n\n");
}

function parseClaudeJson(raw: string): { answer: string; guideSection: string | null } {
  // Strip markdown fences Claude might add despite instructions
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      answer: "Luv isn't configured yet — ask your venue coordinator directly.",
      guideSection: null,
    });
  }

  const supabase = await createClient();

  const { data: venueInfo, error: infoErr } = await supabase.rpc("get_venue_info_for_portal", { p_token: token });
  if (infoErr) return NextResponse.json({ error: infoErr.message }, { status: 500 });

  const venueName = (venueInfo as { venue_name?: string } | null)?.venue_name ?? "your venue";

  const info: VenueInfo = {
    venueName,
    parkingInfo:          venueInfo?.parking_info,
    transportation:       venueInfo?.transportation,
    faqs:                 venueInfo?.faqs,
    policies:             venueInfo?.policies,
    ceremonyInstructions: venueInfo?.ceremony_instructions,
    rainPlan:             venueInfo?.rain_plan,
    nearbyAccommodations: venueInfo?.nearby_accommodations,
    thingsToDo:           venueInfo?.things_to_do,
    importantContacts:    venueInfo?.important_contacts,
    hotelBlocks:          venueInfo?.hotel_blocks,
  };

  const systemPrompt = buildContext(info, venueName);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":           apiKey,
        "anthropic-version":   "2023-06-01",
        "content-type":        "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 600,
        system:     systemPrompt,
        messages:   [{ role: "user", content: `Question from the couple: "${question.trim()}"` }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic API error:", await res.text());
      return NextResponse.json({
        answer: "Luv had trouble answering that right now. Try asking your venue coordinator directly.",
        guideSection: null,
      });
    }

    const data = await res.json() as { content: { type: string; text: string }[] };
    const raw = data.content.find((c) => c.type === "text")?.text ?? "";
    const { answer, guideSection } = parseClaudeJson(raw);

    return NextResponse.json({ answer, guideSection });
  } catch (err) {
    console.error("luv-ask error:", err);
    return NextResponse.json({
      answer: "Luv couldn't connect right now. Please try again.",
      guideSection: null,
    });
  }
}
