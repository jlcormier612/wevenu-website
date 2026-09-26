/**
 * Couple Ask Luv — system prompt assembly (HTC product + Venue Guide layers).
 * Kept separate from the route so tests can assert layering without OpenAI.
 */

import {
  formatCoupleHtcKnowledgeForPrompt,
  formatPortalContextPlaceholderForPrompt,
  type CoupleHtcKnowledgeHit,
} from "@/lib/luv/couple-htc-knowledge";

export type VenueAskInfo = {
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

function hasContent(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function formatVenueKnowledge(info: VenueAskInfo): string {
  const parts: string[] = [
    `--- VENUE KNOWLEDGE ---`,
    `source: venue_guide`,
    `This is what this specific venue has provided about itself. It is NOT Hello to Cheers product documentation.`,
  ];

  if (hasContent(info.policies))
    parts.push(`Policies & Rules (guideSection: "policies"):\n${info.policies}`);

  if (hasContent(info.parkingInfo) || hasContent(info.transportation)) {
    parts.push(`Parking & Transportation (guideSection: "parking"):`);
    if (hasContent(info.parkingInfo)) parts.push(info.parkingInfo!);
    if (hasContent(info.transportation)) parts.push(info.transportation!);
  }

  if (hasContent(info.ceremonyInstructions))
    parts.push(`Ceremony & Arrival (guideSection: "ceremony"):\n${info.ceremonyInstructions}`);

  if (hasContent(info.rainPlan))
    parts.push(`Weather & Rain Plan (guideSection: "weather"):\n${info.rainPlan}`);

  if (hasContent(info.nearbyAccommodations) || info.hotelBlocks?.length) {
    parts.push(`Accommodations (guideSection: "accommodations"):`);
    if (hasContent(info.nearbyAccommodations)) parts.push(info.nearbyAccommodations!);
    if (info.hotelBlocks?.length) {
      parts.push("Hotel Blocks:");
      for (const h of info.hotelBlocks) {
        parts.push(
          `- ${h.name}${h.code ? ` (booking code: ${h.code})` : ""}${h.url ? ` — ${h.url}` : ""}${h.notes ? ` — ${h.notes}` : ""}`,
        );
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
      parts.push(
        `- ${c.name} (${c.role})${c.phone ? ` — ${c.phone}` : ""}${c.email ? ` — ${c.email}` : ""}`,
      );
    }
  }

  if (parts.length === 3) {
    parts.push(`(No Venue Guide content is available for this venue yet.)`);
  }

  return parts.join("\n\n");
}

export function buildCoupleAskLuvSystemPrompt(params: {
  venueName: string;
  voiceInstruction: string;
  htcHits: CoupleHtcKnowledgeHit[];
  venueInfo: VenueAskInfo;
}): string {
  const { venueName, voiceInstruction, htcHits, venueInfo } = params;

  return [
    `You are Luv 💗, the warm and knowledgeable wedding assistant for ${venueName}.`,
    `You help couples planning their wedding by answering questions clearly, warmly, and concisely.`,
    ``,
    `You have distinct knowledge layers. Never confuse them:`,
    `1. HTC PRODUCT KNOWLEDGE — how Hello to Cheers works (portal how-tos, statuses, workflows).`,
    `2. VENUE KNOWLEDGE — what this specific venue has written in its Venue Guide.`,
    `3. CURRENT PORTAL CONTEXT — live facts about this couple's event (payment amounts, contract records, etc.). Not provided in this phase unless a block below says otherwise.`,
    `4. UNKNOWN — anything not established by the layers above.`,
    ``,
    `IMPORTANT — RESPONSE FORMAT:`,
    `Always respond with a single valid JSON object. Do not include markdown fences or any text outside the JSON.`,
    `Format:`,
    `{`,
    `  "answer": "Your warm, helpful answer here. One to three short paragraphs. No markdown formatting.",`,
    `  "guideSection": "<section_key> | null"`,
    `}`,
    ``,
    `GUIDE SECTION KEYS — set guideSection to the most relevant Venue Guide key when your answer draws from Venue Knowledge. Set null for HTC product how-tos or when not applicable:`,
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
    `- Only use the information in the knowledge layers below.`,
    `- ${voiceInstruction}`,
    `- For "how does Hello to Cheers work?" questions, answer from HTC PRODUCT KNOWLEDGE when present.`,
    `- For "what does this venue allow / offer?" questions, answer from VENUE KNOWLEDGE when present.`,
    `- If HTC PRODUCT KNOWLEDGE does not cover a product how-to, say the available HTC guidance does not cover it. Do not invent product capabilities.`,
    `- If VENUE KNOWLEDGE does not cover a venue question, say so honestly and suggest they ask their coordinator.`,
    `- Never substitute generic wedding advice. Never say "Typically, couples…"`,
    `- Never make up venue policies, URLs, contacts, payment amounts, due dates, or contract states.`,
    `- Never reference vendor-only setup, load-in, or dock details — those are outside the couple-facing guide.`,
    `- Never expose staff-only settings paths or venue-team operational instructions.`,
    `- When you reference Venue Guide information, set guideSection accordingly.`,
    ``,
    formatCoupleHtcKnowledgeForPrompt(htcHits),
    ``,
    formatVenueKnowledge(venueInfo),
    ``,
    formatPortalContextPlaceholderForPrompt(),
    ``,
    `--- UNKNOWN ---`,
    `Anything not established above is unknown. Say so honestly.`,
  ].join("\n");
}
