/**
 * Deterministic privacy scope for Couple Ask Luv.
 *
 * Prevents volunteering THIS couple's financial facts when the question is about
 * someone else (or mixes "our" finances with another person's private ask).
 */

export type CoupleAskPrivacyKind =
  | "own_portal"
  | "unrelated_person_private"
  | "mixed_own_and_unrelated_private"
  | "general";

export type CoupleAskPrivacyScope = {
  kind: CoupleAskPrivacyKind;
  /** True when the ask targets financial / payment / contract privacy. */
  financial: boolean;
  /** Other-person name tokens detected (not matching this couple). */
  foreignNameHints: string[];
};

const FINANCIAL_RE =
  /\b(payment|payments|paid|pay|balance|balances|invoice|invoices|owe|owing|due|deposit|financial|finances|money|cost|price|contract|contracts|signature|signed)\b/i;

const PRIVATE_RE =
  /\b(private|internal|staff\s+notes?|unpublished|confidential|secret)\b/i;

/** Own-couple financial ask — avoid matching "tell me about Ron's payment". */
const OWN_FINANCIAL_RE =
  /\b(our|ours|my|mine|we)\b[\s\S]{0,48}\b(payment|payments|paid|pay|balance|balances|invoice|invoices|owe|owing|due|deposit|financial|finances|contract|contracts)\b|\b(payment|payments|paid|pay|balance|balances|invoice|invoices|owe|owing|due|deposit|financial|finances|contract|contracts)\b[\s\S]{0,48}\b(our|ours|my|mine)\b/i;

/** Common English words that look capitalized but are not person names. */
const NAME_STOP = new Set([
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "how",
  "can",
  "could",
  "would",
  "should",
  "please",
  "tell",
  "about",
  "this",
  "that",
  "the",
  "venue",
  "guide",
  "portal",
  "payments",
  "payment",
  "documents",
  "document",
  "contract",
  "contracts",
  "questionnaire",
  "timeline",
  "tasks",
  "task",
  "hello",
  "cheers",
  "luv",
]);

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9'-]/g, "");
}

function coupleNameSet(names: string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of names) {
    const n = normalizeToken(raw);
    if (n.length >= 2) set.add(n);
  }
  return set;
}

/**
 * Extract likely person-name tokens from a question (simple Proper-case heuristic).
 */
export function extractLikelyPersonNameTokens(question: string): string[] {
  const matches = question.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [];
  const out: string[] = [];
  for (const m of matches) {
    const parts = m.split(/\s+/);
    for (const p of parts) {
      const n = normalizeToken(p);
      if (n.length < 2) continue;
      if (NAME_STOP.has(n)) continue;
      if (!out.includes(n)) out.push(n);
    }
  }
  return out;
}

export function classifyCoupleAskPrivacyScope(input: {
  question: string;
  /** First/last/partner names for THIS authenticated couple portal. */
  coupleNames: string[];
}): CoupleAskPrivacyScope {
  const q = input.question.trim();
  const couple = coupleNameSet(input.coupleNames);
  const tokens = extractLikelyPersonNameTokens(q);
  const foreign = tokens.filter((t) => !couple.has(t));
  const financial = FINANCIAL_RE.test(q) || PRIVATE_RE.test(q);
  const ownFinancial = OWN_FINANCIAL_RE.test(q);

  if (foreign.length > 0 && financial && ownFinancial) {
    return { kind: "mixed_own_and_unrelated_private", financial: true, foreignNameHints: foreign };
  }
  if (foreign.length > 0 && financial) {
    return { kind: "unrelated_person_private", financial: true, foreignNameHints: foreign };
  }
  if (ownFinancial) {
    return { kind: "own_portal", financial: true, foreignNameHints: [] };
  }
  return {
    kind: "general",
    financial: FINANCIAL_RE.test(q),
    foreignNameHints: foreign,
  };
}

export const UNRELATED_PERSON_PRIVATE_REFUSAL =
  "I can only discuss details from your couple portal and published Venue Guide. I can’t share another person’s payments, contracts, or private venue information.";

/**
 * Build a refusal that optionally includes THIS couple's payment answer for mixed asks.
 * Never invent amounts — caller supplies a preformatted portal payment summary or null.
 */
export function buildPrivacyScopedAskAnswer(input: {
  scope: CoupleAskPrivacyScope;
  /** Short authoritative summary of THIS couple's payments, or null when unavailable. */
  ownPaymentSummary: string | null;
}): { answer: string; includeOwnPayments: boolean } {
  if (input.scope.kind === "unrelated_person_private") {
    return { answer: UNRELATED_PERSON_PRIVATE_REFUSAL, includeOwnPayments: false };
  }
  if (input.scope.kind === "mixed_own_and_unrelated_private") {
    const own = input.ownPaymentSummary?.trim();
    if (own) {
      return {
        answer: `${own}\n\n${UNRELATED_PERSON_PRIVATE_REFUSAL}`,
        includeOwnPayments: true,
      };
    }
    return {
      answer: `I don’t have a live payment summary for your portal in this chat.\n\n${UNRELATED_PERSON_PRIVATE_REFUSAL}`,
      includeOwnPayments: false,
    };
  }
  return { answer: "", includeOwnPayments: false };
}

/** True when Ask should short-circuit without OpenAI for privacy. */
export function shouldShortCircuitPrivacyAsk(scope: CoupleAskPrivacyScope): boolean {
  return (
    scope.kind === "unrelated_person_private" ||
    scope.kind === "mixed_own_and_unrelated_private"
  );
}
