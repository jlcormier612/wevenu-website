/**
 * Couple Ask → Venue Guide gap topics (Luv Intelligence — Guide Gap layer).
 *
 * Deterministic keyword/phrase classification only. No embeddings / LLM topics.
 * Exotic-animal terms are evaluated BEFORE pet terms so elephants/llamas never
 * count as evidence that the published pet policy is missing.
 */

export const ASK_GAP_WINDOW_DAYS = 30;
export const ASK_GAP_MIN_COUNT = 3;

export const ASK_GAP_TOPICS = [
  "pet_policy",
  "exotic_animal_policy",
  "alcohol_policy",
] as const;

export type AskGapTopic = (typeof ASK_GAP_TOPICS)[number];

export const ASK_GAP_TOPIC_LABELS: Record<AskGapTopic, string> = {
  pet_policy: "pets",
  exotic_animal_policy: "exotic animals",
  alcohol_policy: "alcohol / outside beverages",
};

/** Guide section(s) inspected for coverage (client projection). */
export const ASK_GAP_TOPIC_GUIDE_SECTIONS: Record<AskGapTopic, readonly string[]> = {
  pet_policy: ["policies", "faqs"],
  exotic_animal_policy: ["policies", "faqs"],
  alcohol_policy: ["policies", "faqs"],
};

export function recommendationTypeForAskGapTopic(topic: AskGapTopic): string {
  return `client_ask_gap_${topic}`;
}

export function askGapTopicFromRecommendationType(type: string): AskGapTopic | null {
  if (!type.startsWith("client_ask_gap_")) return null;
  const topic = type.slice("client_ask_gap_".length);
  return (ASK_GAP_TOPICS as readonly string[]).includes(topic)
    ? (topic as AskGapTopic)
    : null;
}

function normalizeQuestion(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Non-Guide gaps — keep as signals, never recommend Guide updates. */
const EXCLUDE_PATTERNS: RegExp[] = [
  /\bhelp me phrase\b/,
  /\bphrase a (short )?question\b/,
  /\bquestion i can send\b/,
  /\bpayment\b/,
  /\bpay(ing|ment|ments)?\b/,
  /\binvoice\b/,
  /\bdeposit\b/,
  /\bdue date\b/,
  /\bcontract\b/,
  /\bsign(ature|ing)?\b/,
  /\bdocument(s)?\b/,
  /\bquestionnaire\b/,
  /\bhow do i (submit|upload|open|view)\b/,
  /\bportal\b/,
  /\bhello to cheers\b/,
];

/**
 * Exotic / livestock / non-domestic animals — checked first.
 * Conservative: only high-confidence species / category words.
 */
const EXOTIC_PATTERNS: RegExp[] = [
  /\belephant(s)?\b/,
  /\bllama(s)?\b/,
  /\balpaca(s)?\b/,
  /\bcamel(s)?\b/,
  /\bzebra(s)?\b/,
  /\btiger(s)?\b/,
  /\blion(s)?\b/,
  /\bpeacock(s)?\b/,
  /\bgoat(s)?\b/,
  /\bsheep\b/,
  /\bcow(s)?\b/,
  /\bpig(s)?\b/,
  /\bhorse(s)?\b/,
  /\bpony|ponies\b/,
  /\bdonkey(s)?\b/,
  /\blivestock\b/,
  /\bfarm animal(s)?\b/,
  /\bexotic animal(s)?\b/,
  /\bwild animal(s)?\b/,
];

/** Domestic pets — dogs/cats/etc. Never elephants/llamas (those are exotic). */
const PET_PATTERNS: RegExp[] = [
  /\bpet(s)?\b/,
  /\bdog(s)?\b/,
  /\bcat(s)?\b/,
  /\bpuppy|puppies\b/,
  /\bkitten(s)?\b/,
  /\bpup(s)?\b/,
  /\bservice (dog|animal)\b/,
  /\bemotional support (animal|dog)\b/,
];

const ALCOHOL_PATTERNS: RegExp[] = [
  /\balcohol\b/,
  /\bbyob\b/,
  /\boutside (alcohol|beer|wine|liquor|drinks|beverages)\b/,
  /\b(beer|wine|liquor|champagne|bar) (package|service|allowed|permitted)?\b/,
  /\bopen bar\b/,
  /\bcorkage\b/,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Classify a Couple Ask question into a Guide-gap topic, or null if not
 * confidently venue-Guide-specific.
 */
export function classifyAskGapTopic(question: string): AskGapTopic | null {
  const q = normalizeQuestion(question);
  if (!q) return null;
  if (matchesAny(q, EXCLUDE_PATTERNS)) return null;

  // Exotic BEFORE pet so "live elephants" never lands in pet_policy.
  if (matchesAny(q, EXOTIC_PATTERNS)) return "exotic_animal_policy";
  if (matchesAny(q, PET_PATTERNS)) return "pet_policy";
  if (matchesAny(q, ALCOHOL_PATTERNS)) return "alcohol_policy";
  return null;
}

/** Coverage: topic-specific terms must appear in published client Guide text. */
const PET_COVERAGE_PATTERNS: RegExp[] = [
  /\bpet(s)?\b/,
  /\bdog(s)?\b/,
  /\bcat(s)?\b/,
  /\bservice (dog|animal)\b/,
];

const EXOTIC_COVERAGE_PATTERNS: RegExp[] = [
  /\belephant/,
  /\bllama/,
  /\balpaca/,
  /\blivestock/,
  /\bfarm animal/,
  /\bexotic animal/,
  /\bwild animal/,
  /\bhorse(s)?\b/,
  /\bpony|ponies\b/,
];

const ALCOHOL_COVERAGE_PATTERNS: RegExp[] = [
  /\balcohol/,
  /\bbyob/,
  /\bcorkage/,
  /\boutside (alcohol|beer|wine|liquor|drinks)/,
  /\bopen bar/,
  /\bbeer/,
  /\bwine/,
  /\bliquor/,
];

export type AskGapGuideProjection = {
  policies?: string | null;
  faqs?: ReadonlyArray<{ question: string; answer: string }> | null;
};

function guideCorpus(guide: AskGapGuideProjection | null | undefined): string {
  if (!guide) return "";
  const parts: string[] = [];
  if (typeof guide.policies === "string") parts.push(guide.policies);
  for (const f of guide.faqs ?? []) {
    if (f?.question) parts.push(f.question);
    if (f?.answer) parts.push(f.answer);
  }
  return parts.join("\n").toLowerCase();
}

/**
 * Whether the published client Guide adequately covers the topic.
 * Pet coverage does NOT satisfy exotic coverage (and vice versa).
 */
export function publishedClientGuideCoversTopic(
  topic: AskGapTopic,
  guide: AskGapGuideProjection | null | undefined,
): boolean {
  const text = guideCorpus(guide);
  if (!text.trim()) return false;

  switch (topic) {
    case "pet_policy":
      return matchesAny(text, PET_COVERAGE_PATTERNS);
    case "exotic_animal_policy":
      return matchesAny(text, EXOTIC_COVERAGE_PATTERNS);
    case "alcohol_policy":
      return matchesAny(text, ALCOHOL_COVERAGE_PATTERNS);
    default:
      return false;
  }
}

export function buildAskGapRecommendationCopy(topic: AskGapTopic, gapCount: number): {
  title: string;
  body: string;
} {
  const label = ASK_GAP_TOPIC_LABELS[topic];
  const n = gapCount;
  return {
    title: `Clients have asked about ${label} ${n} times in the last ${ASK_GAP_WINDOW_DAYS} days.`,
    body:
      "Your published Venue Guide doesn't currently answer this clearly. Consider adding it to your Venue Guide — you stay in control of what gets published.",
  };
}

export const ASK_GAP_GUIDE_CTA = {
  label: "Open Venue Guide",
  target: "/guide",
  type: "navigate" as const,
};
