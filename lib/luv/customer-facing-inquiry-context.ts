/**
 * Gate 2 — customer-facing naturalness for Luv follow-up drafts.
 *
 * Gate 1 (provenance) remains in inquiry-message-origin.ts:
 * only origin === "customer" is eligible here.
 *
 * This module never weakens Gate 1. Non-customer origins → excluded.
 * Eligible customer text is split and filtered with narrow, high-confidence
 * deterministic withhold rules before any fragment may enter the prompt.
 */

import { customerFacingInquiryMessage } from "@/lib/leads/inquiry-message-origin";

export type CustomerFacingInquiryContext =
  | { status: "excluded" }
  | { status: "none_usable" }
  | { status: "usable"; details: string[] };

/**
 * High-confidence withhold patterns for relationship / third-person /
 * staff-style commentary about people. Deliberately narrow.
 */
const WITHHOLD_PATTERNS: RegExp[] = [
  // "keeping Charlie on his toes" / her/their toes
  /\bkeep(?:ing)?\s+\w+\s+on\s+(?:his|her|their)\s+toes\b/i,
  /\bon\s+(?:his|her|their)\s+toes\b/i,
  // Speculative third-person vibe commentary
  /\bsounds\s+like\s+it\s+will\s+make\s+the\s+day\b/i,
  /\bsounds\s+like\s+(?:he|she|they|it)\s+(?:will|would|might|may)\b/i,
  // Explicit teasing / joking about the couple
  /\bteas(?:e|ing)\b/i,
  /\bjok(?:e|ing)\s+about\s+(?:them|him|her|the\s+couple)\b/i,
  // Staff-style "about them" narration
  /\b(?:talking|speaking|gossip(?:ing)?)\s+about\s+(?:them|him|her|the\s+couple)\b/i,
  /\bkeep(?:ing)?\s+(?:him|her|them)\s+(?:honest|in\s+line|on\s+track)\b/i,
];

/** Split inquiry into clause-sized fragments for per-fragment Gate 2 decisions. */
export function splitInquiryFragments(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/(?<=[.!?])\s+|;\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** True when this fragment is high-confidence relationship/third-person commentary. */
export function shouldWithholdInquiryFragment(fragment: string): boolean {
  const text = fragment.trim();
  if (!text) return true;
  return WITHHOLD_PATTERNS.some((re) => re.test(text));
}

/**
 * Gate 1 then Gate 2.
 * - excluded: provenance fail-closed (venue / unknown / invalid / empty)
 * - none_usable: customer-originated but every fragment withheld
 * - usable: only customer-facing-safe fragments
 *
 * Never returns the raw full inquiry when any fragment was withheld —
 * only the filtered details list crosses into the drafting prompt.
 */
export function customerFacingInquiryContext(
  inquiryMessage: string | null | undefined,
  origin: string | null | undefined,
): CustomerFacingInquiryContext {
  const eligible = customerFacingInquiryMessage(inquiryMessage, origin);
  if (eligible == null) return { status: "excluded" };

  const fragments = splitInquiryFragments(eligible);
  const usable: string[] = [];

  for (const fragment of fragments) {
    if (shouldWithholdInquiryFragment(fragment)) continue;
    usable.push(fragment);
  }

  if (usable.length === 0) return { status: "none_usable" };
  return { status: "usable", details: usable };
}
