/**
 * Couple Ask Luv — system prompt assembly (HTC product + Venue Guide + Portal Context).
 * Kept separate from the route so tests can assert layering without OpenAI.
 */

import {
  formatCoupleHtcKnowledgeForPrompt,
  type CoupleHtcKnowledgeHit,
} from "@/lib/luv/couple-htc-knowledge";
import {
  formatPortalContextForPrompt,
  type LuvAskPortalContext,
} from "@/lib/luv/portal-context";

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
  /** Phase 2A — omit or null to keep the Phase 1 placeholder block. */
  portalContext?: LuvAskPortalContext | null;
}): string {
  const { venueName, voiceInstruction, htcHits, venueInfo, portalContext } = params;

  return [
    `You are Luv 💗, the warm and knowledgeable wedding assistant for ${venueName}.`,
    `You help couples planning their wedding by answering questions clearly, warmly, and concisely.`,
    ``,
    `You have distinct knowledge layers. Never confuse them:`,
    `1. HTC PRODUCT KNOWLEDGE — how Hello to Cheers works (portal how-tos, statuses, workflows). source: htc_product`,
    `2. VENUE KNOWLEDGE — what this specific venue has written in its Venue Guide. source: venue_guide`,
    `3. CURRENT PORTAL CONTEXT — live facts about THIS couple's event (payments, contracts, documents). source: portal_context`,
    `4. UNKNOWN — anything not established by the layers above.`,
    ``,
    `IMPORTANT — RESPONSE FORMAT:`,
    `Always respond with a single valid JSON object. Do not include markdown fences or any text outside the JSON.`,
    `Format:`,
    `{`,
    `  "answer": "Your warm, helpful answer here. One to three short paragraphs. No markdown formatting.",`,
    `  "guideSection": "<section_key> | null",`,
    `  "outcome": "<one of the outcomes below>",`,
    `  "nextSteps": ["<next_step_key>", ...]`,
    `}`,
    ``,
    `OUTCOMES — set exactly one:`,
    `  "answered_venue_guide"    → venue-specific fact answered ONLY from VENUE KNOWLEDGE`,
    `  "answered_htc_help"       → Hello to Cheers product/how-to answered ONLY from HTC PRODUCT KNOWLEDGE`,
    `  "answered_portal_context" → THIS couple's payment/contract/document fact answered ONLY from CURRENT PORTAL CONTEXT`,
    `  "information_gap"         → approved sources do not contain enough information to answer without inventing`,
    ``,
    `Never use outcome "unavailable" — that is reserved for infrastructure failures handled outside the model.`,
    ``,
    `NEXT STEPS — required when outcome is "information_gap" (one or more). Use only these keys:`,
    `  "browse_venue_guide" → invite them to browse the Venue Guide`,
    `  "contact_venue"      → point them to published Important Contacts in the Guide (only if contacts are listed below)`,
    `  "phrase_question"    → offer to help them PHRASE a short question they can send themselves (text only; you never send)`,
    `  "open_payments"      → portal payment fact is missing; point them to Payments`,
    `  "open_documents"     → portal document/contract fact is missing; point them to Documents`,
    `When outcome is answered_*, set nextSteps to [].`,
    ``,
    `GUIDE SECTION KEYS — set guideSection when outcome is answered_venue_guide. Otherwise null:`,
    `  "parking"        → Parking & Transportation`,
    `  "accommodations" → Accommodations (hotels, hotel blocks)`,
    `  "weather"        → Weather & Rain Plan (rain plan, contingency)`,
    `  "policies"       → Policies & Rules (what's allowed, vendor rules, restrictions)`,
    `  "ceremony"       → Ceremony & Arrival (ceremony setup, arrival instructions)`,
    `  "things_to_know" → Things To Know (general venue tips)`,
    `  "faqs"           → FAQs`,
    `  "contacts"       → Important Contacts (coordinator, venue team)`,
    ``,
    `AUTHORITATIVE SOURCE RULES:`,
    `- Venue-specific facts (policies, pets, alcohol, parking rules, amenities, restrictions) → ONLY VENUE KNOWLEDGE. Never invent. Never use "typically venues…" or world knowledge.`,
    `- Couple payment/contract/document status → ONLY CURRENT PORTAL CONTEXT.`,
    `- Hello to Cheers product how-tos → ONLY HTC PRODUCT KNOWLEDGE.`,
    `- HTC help and portal context never authorize inventing a venue policy.`,
    ``,
    `RULES:`,
    `- Only use the information in the knowledge layers below.`,
    `- ${voiceInstruction}`,
    `- For "how does Hello to Cheers work?" questions, answer from HTC PRODUCT KNOWLEDGE when present → outcome answered_htc_help.`,
    `- For "what does this venue allow / offer?" questions, answer from VENUE KNOWLEDGE when present → outcome answered_venue_guide.`,
    `- For "what is OUR payment / contract / document status?" questions, answer from CURRENT PORTAL CONTEXT when provided → outcome answered_portal_context.`,
    `- When PORTAL CONTEXT contains an authoritative fact about this couple, it takes precedence over generic HTC assumptions about their current state.`,
    `- If HTC PRODUCT KNOWLEDGE does not cover a product how-to → outcome information_gap; say so; include nextSteps (often phrase_question). Do not invent product capabilities.`,
    `- If VENUE KNOWLEDGE does not cover a venue question → outcome information_gap. Clearly say the information is not in the venue information provided here. Do NOT invent or speculate. Include at least one next step (browse_venue_guide and/or phrase_question; contact_venue only if contacts are listed).`,
    `- If PORTAL CONTEXT does not contain a live fact the couple asked for → outcome information_gap; point them to Payments or Documents via nextSteps; never invent amounts, due dates, or signature states.`,
    `- If the couple asks you to help phrase a question to the venue, provide short suggested wording in "answer" and set outcome information_gap with nextSteps including "phrase_question". You never send messages.`,
    `- Never substitute generic wedding advice. Never say "Typically, couples…" or "Most venues…"`,
    `- Never make up venue policies, URLs, contacts, payment amounts, due dates, or contract states.`,
    `- Never reference vendor-only setup, load-in, or dock details — those are outside the couple-facing guide.`,
    `- Never expose staff-only settings paths or venue-team operational instructions.`,
    `- When you reference Venue Guide information, set guideSection and outcome answered_venue_guide.`,
    ``,
    formatCoupleHtcKnowledgeForPrompt(htcHits),
    ``,
    formatVenueKnowledge(venueInfo),
    ``,
    formatPortalContextForPrompt(portalContext),
    ``,
    `--- UNKNOWN ---`,
    `Anything not established above is unknown. Use outcome "information_gap". Say so honestly and offer a useful next step.`,
  ].join("\n");
}
