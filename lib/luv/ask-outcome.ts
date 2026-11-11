/**
 * Couple Ask Luv — structured outcomes + next-step contract (Luv Intelligence V1).
 *
 * The structured `outcome` field is authoritative for UX and signal persistence.
 * Do not infer gaps by parsing answer prose.
 */

export const LUV_ASK_OUTCOMES = [
  "answered_venue_guide",
  "answered_htc_help",
  "answered_portal_context",
  "information_gap",
  "unavailable",
] as const;

export type LuvAskOutcome = (typeof LUV_ASK_OUTCOMES)[number];

export const LUV_ASK_NEXT_STEP_TYPES = [
  "browse_venue_guide",
  "contact_venue",
  "phrase_question",
  "open_payments",
  "open_documents",
] as const;

export type LuvAskNextStepType = (typeof LUV_ASK_NEXT_STEP_TYPES)[number];

export const LUV_ASK_KNOWLEDGE_LAYERS = [
  "venue_guide",
  "htc_product",
  "portal_context",
] as const;

export type LuvAskKnowledgeLayer = (typeof LUV_ASK_KNOWLEDGE_LAYERS)[number];

export const LUV_ASK_GUIDE_SECTION_KEYS = [
  "parking",
  "accommodations",
  "weather",
  "policies",
  "ceremony",
  "things_to_know",
  "faqs",
  "contacts",
] as const;

export type LuvAskGuideSection = (typeof LUV_ASK_GUIDE_SECTION_KEYS)[number];

const OUTCOME_SET = new Set<string>(LUV_ASK_OUTCOMES);
const NEXT_STEP_SET = new Set<string>(LUV_ASK_NEXT_STEP_TYPES);
const GUIDE_SECTION_SET = new Set<string>(LUV_ASK_GUIDE_SECTION_KEYS);

export type ParsedLuvAskModelResponse = {
  answer: string;
  guideSection: LuvAskGuideSection | null;
  outcome: LuvAskOutcome;
  nextSteps: LuvAskNextStepType[];
};

export function isLuvAskOutcome(value: unknown): value is LuvAskOutcome {
  return typeof value === "string" && OUTCOME_SET.has(value);
}

export function isLuvAskNextStepType(value: unknown): value is LuvAskNextStepType {
  return typeof value === "string" && NEXT_STEP_SET.has(value);
}

export function knowledgeLayerForOutcome(
  outcome: LuvAskOutcome,
): LuvAskKnowledgeLayer | null {
  switch (outcome) {
    case "answered_venue_guide":
      return "venue_guide";
    case "answered_htc_help":
      return "htc_product";
    case "answered_portal_context":
      return "portal_context";
    default:
      return null;
  }
}

/** Default next steps when the model omits them on an information_gap. */
export function defaultNextStepsForGap(opts?: {
  hasPublishedContacts?: boolean;
  portalLayerHint?: "payments" | "documents" | null;
}): LuvAskNextStepType[] {
  if (opts?.portalLayerHint === "payments") {
    return ["open_payments", "phrase_question"];
  }
  if (opts?.portalLayerHint === "documents") {
    return ["open_documents", "phrase_question"];
  }
  const steps: LuvAskNextStepType[] = ["browse_venue_guide", "phrase_question"];
  if (opts?.hasPublishedContacts) steps.push("contact_venue");
  return steps;
}

export function normalizeNextSteps(
  raw: unknown,
  outcome: LuvAskOutcome,
  opts?: { hasPublishedContacts?: boolean },
): LuvAskNextStepType[] {
  const fromModel: LuvAskNextStepType[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isLuvAskNextStepType(item) && !fromModel.includes(item)) {
        fromModel.push(item);
      }
    }
  }

  if (outcome !== "information_gap") {
    return fromModel;
  }

  if (fromModel.length > 0) {
    return fromModel;
  }

  return defaultNextStepsForGap({
    hasPublishedContacts: opts?.hasPublishedContacts,
  });
}

/**
 * Parse model JSON into the Ask response contract.
 * Invalid/missing outcome after a successful model call fails closed to
 * information_gap (never invent answered_*).
 */
export function parseLuvAskModelResponse(
  raw: string,
  opts?: { hasPublishedContacts?: boolean },
): ParsedLuvAskModelResponse {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      answer?: unknown;
      guideSection?: unknown;
      outcome?: unknown;
      nextSteps?: unknown;
    };
    const answer =
      typeof parsed.answer === "string" && parsed.answer.trim()
        ? parsed.answer.trim()
        : cleaned;
    const guideSection =
      typeof parsed.guideSection === "string" && GUIDE_SECTION_SET.has(parsed.guideSection)
        ? (parsed.guideSection as LuvAskGuideSection)
        : null;

    let outcome: LuvAskOutcome;
    if (isLuvAskOutcome(parsed.outcome) && parsed.outcome !== "unavailable") {
      outcome = parsed.outcome;
    } else if (guideSection && !isLuvAskOutcome(parsed.outcome)) {
      // Model forgot outcome but cited a Guide section — treat as Guide answer.
      outcome = "answered_venue_guide";
    } else {
      outcome = "information_gap";
    }

    // Guide section only valid for Guide answers.
    const resolvedSection = outcome === "answered_venue_guide" ? guideSection : null;

    return {
      answer,
      guideSection: resolvedSection,
      outcome,
      nextSteps: normalizeNextSteps(parsed.nextSteps, outcome, opts),
    };
  } catch {
    return {
      answer: cleaned || raw.trim(),
      guideSection: null,
      outcome: "information_gap",
      nextSteps: defaultNextStepsForGap({
        hasPublishedContacts: opts?.hasPublishedContacts,
      }),
    };
  }
}

export function unavailableAskResponse(answer: string): {
  answer: string;
  guideSection: null;
  outcome: "unavailable";
  nextSteps: [];
} {
  return {
    answer,
    guideSection: null,
    outcome: "unavailable",
    nextSteps: [],
  };
}

/** Human labels for gap next-step chips in the portal UI. */
export const LUV_ASK_NEXT_STEP_LABELS: Record<LuvAskNextStepType, string> = {
  browse_venue_guide: "Browse your Venue Guide",
  contact_venue: "See venue contacts in the Guide",
  phrase_question: "Help me phrase a question",
  open_payments: "Open Payments",
  open_documents: "Open Documents",
};

export const PHRASE_QUESTION_FOLLOW_UP =
  "Can you help me phrase a short question I can send the venue about this?";
