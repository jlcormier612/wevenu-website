/**
 * POST /api/rsvp/concierge
 *
 * Guest asks Luv a question about the wedding — parking, directions,
 * dress code, what to expect. Grounded strictly in the couple's own
 * published website content plus the venue's operational info; never
 * invents an answer it can't source. Guest-token authenticated
 * (rsvp_token), not the couple's portal token.
 *
 * Body:     { rsvpToken: string; question: string }
 * Response: { answer: string } | { error: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

type ConciergeContext = {
  couple?: { firstName?: string; partnerFirstName?: string };
  event?: { name?: string; eventDate?: string; eventType?: string };
  venue?: { name?: string };
  websiteContent?: {
    dressCode?: { formality?: string; description?: string; colorNote?: string } | null;
    faq?: { question: string; answer: string }[] | null;
    travel?: { message?: string; hotels?: { name: string; url?: string; code?: string; notes?: string }[]; transportation?: { notes?: string } } | null;
    thingsToDo?: { title?: string; intro?: string; items?: { name: string; description?: string; address?: string }[] } | null;
  };
  venueInfo?: {
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
  error?: string;
};

function hasContent(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function buildContext(ctx: ConciergeContext): string {
  const coupleName = [ctx.couple?.firstName, ctx.couple?.partnerFirstName].filter(Boolean).join(" & ") || "the couple";
  const venueName = ctx.venue?.name ?? "the venue";
  const parts: string[] = [];

  parts.push(
    `You are Luv 💗, a warm hospitality concierge helping a wedding guest of ${coupleName}, at ${venueName}.`,
    `You are not a chatbot or a search engine — you're a concierge at a front desk, giving a short, warm, useful answer and stopping. Never ramble, never over-explain.`,
    ``,
    `IMPORTANT — RESPONSE FORMAT: Respond with a single valid JSON object, no markdown fences, no text outside the JSON:`,
    `{ "answer": "Your warm, concise answer. One short paragraph. No markdown." }`,
    ``,
    `RULES:`,
    `- Only answer from the information provided below. If something isn't covered, say so honestly and suggest they ask the couple or venue directly — never guess or invent details (dress code, timing, addresses).`,
    `- Never reveal any other guest's information — you don't have access to any, and none is provided to you.`,
    `- Never report on this guest's own RSVP status, meal choice, or activity — you're not a status dashboard.`,
    `- Keep the tone like a host who's genuinely glad they're coming, never like a customer-service bot.`,
    ``,
    `--- WHAT YOU KNOW ---`,
  );

  if (ctx.event?.eventDate) {
    const date = new Date(ctx.event.eventDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    parts.push(`The wedding is on ${date}${ctx.event.name ? ` (${ctx.event.name})` : ""}.`);
  }

  const dc = ctx.websiteContent?.dressCode;
  if (dc && (hasContent(dc.formality) || hasContent(dc.description) || hasContent(dc.colorNote))) {
    parts.push(`Dress Code (from the couple's own website):`);
    if (hasContent(dc.formality))    parts.push(`Formality: ${dc.formality}`);
    if (hasContent(dc.description))  parts.push(dc.description!);
    if (hasContent(dc.colorNote))    parts.push(`Color note: ${dc.colorNote}`);
  }

  if (ctx.websiteContent?.faq?.length) {
    parts.push(`FAQ (from the couple's own website):`);
    for (const f of ctx.websiteContent.faq) parts.push(`Q: ${f.question}\nA: ${f.answer}`);
  }

  const travel = ctx.websiteContent?.travel;
  if (travel && (hasContent(travel.message) || travel.hotels?.length || hasContent(travel.transportation?.notes))) {
    parts.push(`Travel & Hotels (from the couple's own website):`);
    if (hasContent(travel.message)) parts.push(travel.message!);
    if (travel.hotels?.length) {
      for (const h of travel.hotels) parts.push(`- ${h.name}${h.code ? ` (booking code: ${h.code})` : ""}${h.notes ? ` — ${h.notes}` : ""}`);
    }
    if (hasContent(travel.transportation?.notes)) parts.push(travel.transportation!.notes!);
  }

  const ttd = ctx.websiteContent?.thingsToDo;
  if (ttd?.items?.length) {
    parts.push(`Things To Do (from the couple's own website):`);
    for (const it of ttd.items) parts.push(`- ${it.name}${it.description ? `: ${it.description}` : ""}`);
  }

  const vi = ctx.venueInfo;
  if (vi) {
    if (hasContent(vi.policies)) parts.push(`Venue Policies:\n${vi.policies}`);
    if (hasContent(vi.parkingInfo) || hasContent(vi.transportation)) {
      parts.push(`Parking & Transportation:`);
      if (hasContent(vi.parkingInfo))    parts.push(vi.parkingInfo!);
      if (hasContent(vi.transportation)) parts.push(vi.transportation!);
    }
    if (hasContent(vi.ceremonyInstructions)) parts.push(`Ceremony & Arrival:\n${vi.ceremonyInstructions}`);
    if (hasContent(vi.rainPlan))             parts.push(`Weather & Rain Plan:\n${vi.rainPlan}`);
    if (hasContent(vi.nearbyAccommodations) || vi.hotelBlocks?.length) {
      parts.push(`Accommodations:`);
      if (hasContent(vi.nearbyAccommodations)) parts.push(vi.nearbyAccommodations!);
      if (vi.hotelBlocks?.length) {
        for (const h of vi.hotelBlocks) parts.push(`- ${h.name}${h.code ? ` (booking code: ${h.code})` : ""}${h.url ? ` — ${h.url}` : ""}`);
      }
    }
    if (vi.faqs?.length) {
      parts.push(`Venue FAQs:`);
      for (const f of vi.faqs) parts.push(`Q: ${f.question}\nA: ${f.answer}`);
    }
    if (vi.importantContacts?.length) {
      parts.push(`Important Contacts:`);
      for (const c of vi.importantContacts) parts.push(`- ${c.name} (${c.role})${c.phone ? ` — ${c.phone}` : ""}`);
    }
  }

  return parts.join("\n\n");
}

function parseClaudeJson(raw: string): string {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { answer?: unknown };
    return typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer.trim() : raw.trim();
  } catch {
    return raw.trim();
  }
}

export async function POST(request: Request) {
  let body: { rsvpToken?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { rsvpToken, question } = body;
  if (!rsvpToken || !question?.trim()) {
    return NextResponse.json({ error: "missing_token_or_question" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_concierge_context", { p_rsvp_token: rsvpToken });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ctx = data as ConciergeContext | null;
  if (!ctx || ctx.error) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  // Token validated first so an invalid guest token is always rejected,
  // regardless of whether Anthropic is configured in this environment.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ answer: "This isn't set up yet — please reach out to the couple directly." });
  }

  const systemPrompt = buildContext(ctx);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 400,
        system:     systemPrompt,
        messages:   [{ role: "user", content: `Question from a wedding guest: "${question.trim()}"` }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic API error:", await res.text());
      return NextResponse.json({ answer: "I had trouble with that one — feel free to reach out to the couple directly." });
    }

    const result = await res.json() as { content: { type: string; text: string }[] };
    const raw = result.content.find((c) => c.type === "text")?.text ?? "";
    return NextResponse.json({ answer: parseClaudeJson(raw) });
  } catch (err) {
    console.error("rsvp concierge error:", err);
    return NextResponse.json({ answer: "Something went wrong — please try again." });
  }
}
