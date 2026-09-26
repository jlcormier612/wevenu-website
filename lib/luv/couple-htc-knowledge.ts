/**
 * Couple Ask Luv — HTC product knowledge projection + deterministic retrieval.
 *
 * Canonical source: FINAL_HELP_ARTICLES (staff Help + couple-portal articles).
 * Couples never receive raw staff-only bodies. Retrieval is keyword/slug based —
 * no semantic search platform.
 */

import {
  FINAL_HELP_ARTICLES,
  type FinalHelpArticle,
  type HelpArticleAudience,
} from "@/lib/help-guides/final-articles";

export type CoupleHtcKnowledgeProvenance = {
  /** Distinct from Venue Guide knowledge. */
  source: "htc_product";
  slug: string;
  title: string;
  audience: "couple";
  category: string;
  /** Staff article slug when this projection adapts a both-audience article. */
  canonicalSlug: string;
};

export type CoupleHtcKnowledgeHit = CoupleHtcKnowledgeProvenance & {
  body: string;
  score: number;
  matchedTerms: string[];
};

export type CoupleKnowledgeClassification =
  | "couple-safe"
  | "staff-only"
  | "requires-projection"
  | "insufficient";

export type ClassifiedHelpArticle = {
  slug: string;
  title: string;
  audience: HelpArticleAudience;
  classification: CoupleKnowledgeClassification;
  reason: string;
};

function articleAudience(article: FinalHelpArticle): HelpArticleAudience {
  return article.audience ?? "staff";
}

/**
 * Project one canonical article for the couple audience.
 * Returns null when staff-only or when both-audience lacks coupleBody.
 */
export function projectHelpArticleForCouple(
  article: FinalHelpArticle,
): CoupleHtcKnowledgeHit | null {
  const audience = articleAudience(article);

  if (audience === "staff") return null;

  if (audience === "both") {
    if (!article.coupleBody?.trim()) return null;
    return {
      source: "htc_product",
      slug: article.slug,
      canonicalSlug: article.slug,
      title: article.coupleTitle?.trim() || article.title,
      audience: "couple",
      category: article.category,
      body: article.coupleBody.trim(),
      score: 0,
      matchedTerms: [],
    };
  }

  // audience === "couple"
  return {
    source: "htc_product",
    slug: article.slug,
    canonicalSlug: article.slug,
    title: article.title,
    audience: "couple",
    category: article.category,
    body: article.body.trim(),
    score: 0,
    matchedTerms: [],
  };
}

/** All couple-safe projected HTC articles (staff-only excluded). */
export function listCoupleSafeHtcKnowledge(): CoupleHtcKnowledgeHit[] {
  const out: CoupleHtcKnowledgeHit[] = [];
  for (const article of FINAL_HELP_ARTICLES) {
    const projected = projectHelpArticleForCouple(article);
    if (projected) out.push(projected);
  }
  return out;
}

export function classifyHelpArticleForCouple(
  article: FinalHelpArticle,
): ClassifiedHelpArticle {
  const audience = articleAudience(article);
  if (audience === "couple") {
    return {
      slug: article.slug,
      title: article.title,
      audience,
      classification: "couple-safe",
      reason: "Couple-portal article; body is couple-facing.",
    };
  }
  if (audience === "both" && article.coupleBody?.trim()) {
    return {
      slug: article.slug,
      title: article.title,
      audience,
      classification: "requires-projection",
      reason: "Staff body kept; coupleBody used for Ask Luv.",
    };
  }
  if (audience === "both") {
    return {
      slug: article.slug,
      title: article.title,
      audience,
      classification: "insufficient",
      reason: "Marked both but missing coupleBody — excluded from Ask Luv.",
    };
  }
  return {
    slug: article.slug,
    title: article.title,
    audience,
    classification: "staff-only",
    reason: "Venue-staff operational guidance; not exposed to couples.",
  };
}

export function classifyAllHelpArticlesForCouple(): ClassifiedHelpArticle[] {
  return FINAL_HELP_ARTICLES.map(classifyHelpArticleForCouple);
}

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Too common for slug-token matching alone. */
const SLUG_TOKEN_STOP = new Set([
  "couple",
  "your",
  "with",
  "from",
  "that",
  "this",
  "what",
  "when",
  "where",
  "does",
  "doing",
  "work",
  "works",
  "working",
  "hello",
  "cheers",
  "portal",
  "after",
  "about",
  "understanding",
  "completing",
  "finding",
  "submitting",
  "overview",
  "status",
  "statuses",
]);

function keywordList(article: FinalHelpArticle, projected: CoupleHtcKnowledgeHit): string[] {
  const fromMeta = article.coupleKeywords ?? [];
  const fromTitle = projected.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !SLUG_TOKEN_STOP.has(w));
  return [...fromMeta.map((k) => k.toLowerCase()), ...fromTitle];
}

/**
 * Deterministic retrieval for Ask Luv.
 * Scores keyword / title / slug phrase matches — no embeddings.
 */
export function retrieveCoupleHtcKnowledge(
  question: string,
  options?: { limit?: number; minScore?: number },
): CoupleHtcKnowledgeHit[] {
  const limit = options?.limit ?? 4;
  const minScore = options?.minScore ?? 6;
  const q = normalizeQuestion(question);
  if (!q) return [];

  const scored: CoupleHtcKnowledgeHit[] = [];

  for (const article of FINAL_HELP_ARTICLES) {
    const projected = projectHelpArticleForCouple(article);
    if (!projected) continue;

    const keywords = keywordList(article, projected);
    const matchedTerms: string[] = [];
    let score = 0;
    let phraseHit = false;

    for (const term of keywords) {
      const t = term.toLowerCase().trim();
      if (!t) continue;
      if (q.includes(t)) {
        matchedTerms.push(t);
        const words = t.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
          phraseHit = true;
          score += 8 + words.length * 2;
        } else if (t.length >= 6) {
          score += 5;
        } else {
          score += 2;
        }
      }
    }

    // Slug token overlap — only distinctive tokens, and only as a boost.
    for (const token of article.slug.split("-")) {
      if (token.length < 5 || SLUG_TOKEN_STOP.has(token)) continue;
      if (q.includes(token) && !matchedTerms.includes(token)) {
        matchedTerms.push(token);
        score += 3;
      }
    }

    // Require a real topical signal — not just "hello" / "portal" noise.
    if (score < minScore && !phraseHit) continue;
    if (score <= 0) continue;
    scored.push({ ...projected, score, matchedTerms });
  }

  scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  return scored.slice(0, limit);
}

/** Format retrieved HTC hits for the Ask Luv system prompt (distinct layer). */
export function formatCoupleHtcKnowledgeForPrompt(hits: CoupleHtcKnowledgeHit[]): string {
  if (hits.length === 0) {
    return [
      `--- HTC PRODUCT KNOWLEDGE ---`,
      `source: htc_product`,
      `audience: couple`,
      `(No matching Hello to Cheers how-to articles were retrieved for this question.)`,
      `If the couple asks how Hello to Cheers works and nothing here covers it, say that the available HTC guidance does not cover that topic. Do not invent product capabilities. Do not give generic wedding advice.`,
    ].join("\n");
  }

  const parts: string[] = [
    `--- HTC PRODUCT KNOWLEDGE ---`,
    `source: htc_product`,
    `audience: couple`,
    `These articles explain how Hello to Cheers works for couples. They are NOT this venue's policies or offerings.`,
  ];

  for (const hit of hits) {
    parts.push(
      "",
      `[HTC article]`,
      `slug: ${hit.slug}`,
      `title: ${hit.title}`,
      `category: ${hit.category}`,
      `audience: couple`,
      hit.body,
    );
  }

  return parts.join("\n");
}

/**
 * Extension point for Phase 2 — portal facts (payments due, contract state, etc.).
 * Phase 1 deliberately returns an empty / placeholder block so the prompt layer
 * stays stable without inventing portal context.
 */
export function formatPortalContextPlaceholderForPrompt(): string {
  return [
    `--- CURRENT PORTAL CONTEXT ---`,
    `status: not_provided_in_phase_1`,
    `(No live payment amounts, contract records, questionnaire rows, lifecycle state, or other portal facts are available in this turn.)`,
    `Do not invent portal facts. If the couple asks for their specific dates, amounts, or statuses, say you do not have that live portal detail in this chat and point them to the matching portal section (Documents, Payments, Tasks, Your Choices) or their coordinator.`,
  ].join("\n");
}
