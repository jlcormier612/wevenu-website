/**
 * CTR-01 content refresh classification — shared by provision runtime and
 * migration tests. Never use source_master_key alone or "missing tokens"
 * as authorization to overwrite.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { WEDDING_VENUE_AGREEMENT_CONTENT } from "@/lib/contracts/starters";

/** Exact stock Ceremony/Reception block from prior CTR-01 masters. */
export const CTR01_STOCK_CEREMONY_RECEPTION_BLOCK =
  "Ceremony\n" +
  "Add your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.\n" +
  "\n" +
  "Reception\n" +
  "Add your venue's approved reception timing and location language here, or leave blank until those details are confirmed.";

/**
 * Ceremony/Reception Smart Field block written by the 106 migration / prior
 * 082 master — before Additional Event Spaces was added to the starter.
 */
export const CTR01_CEREMONY_RECEPTION_ONLY_BLOCK =
  "Ceremony\n{{ceremony_space}}\n\nReception\n{{reception_space}}";

/** Replacement Ceremony/Reception/Additional block for the current master. */
export const CTR01_NEW_CEREMONY_RECEPTION_BLOCK =
  CTR01_CEREMONY_RECEPTION_ONLY_BLOCK +
  "\n\nAdditional Event Spaces\n{{additional_event_spaces}}";

const PRIOR_BODIES_DIR = join(process.cwd(), "lib/contracts/ctr01-prior-bodies");

let cachedPriors: readonly string[] | null = null;

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

/** Exact prior untouched platform CTR-01 bodies (closed allowlist). */
export function knownPriorUntouchedCtr01Bodies(): readonly string[] {
  if (cachedPriors) return cachedPriors;
  const bodies = readdirSync(PRIOR_BODIES_DIR)
    .filter((name) => name.endsWith(".txt"))
    .sort()
    .map((name) => readFileSync(join(PRIOR_BODIES_DIR, name), "utf8"));
  cachedPriors = bodies;
  return bodies;
}

export function isKnownPriorUntouchedCtr01Master(content: string): boolean {
  return knownPriorUntouchedCtr01Bodies().includes(content);
}

export type Ctr01RefreshAction = "full_refresh" | "surgical" | "none";

export function classifyCtr01ContentRefresh(content: string): Ctr01RefreshAction {
  if (content === WEDDING_VENUE_AGREEMENT_CONTENT) return "none";
  if (isKnownPriorUntouchedCtr01Master(content)) return "full_refresh";
  if (countOccurrences(content, CTR01_STOCK_CEREMONY_RECEPTION_BLOCK) === 1) {
    return "surgical";
  }
  // Exact ceremony/reception-only Smart Field block → add Additional section.
  // Guard: never treat the current NEW block as eligible (prefix would match).
  if (
    !content.includes("{{additional_event_spaces}}") &&
    countOccurrences(content, CTR01_CEREMONY_RECEPTION_ONLY_BLOCK) === 1
  ) {
    return "surgical";
  }
  return "none";
}

export function applyCtr01ContentRefresh(content: string): {
  action: Ctr01RefreshAction;
  content: string;
} {
  const action = classifyCtr01ContentRefresh(content);
  if (action === "full_refresh") {
    return { action, content: WEDDING_VENUE_AGREEMENT_CONTENT };
  }
  if (action === "surgical") {
    if (countOccurrences(content, CTR01_STOCK_CEREMONY_RECEPTION_BLOCK) === 1) {
      return {
        action,
        content: content.replace(
          CTR01_STOCK_CEREMONY_RECEPTION_BLOCK,
          CTR01_NEW_CEREMONY_RECEPTION_BLOCK,
        ),
      };
    }
    return {
      action,
      content: content.replace(
        CTR01_CEREMONY_RECEPTION_ONLY_BLOCK,
        CTR01_NEW_CEREMONY_RECEPTION_BLOCK,
      ),
    };
  }
  return { action: "none", content };
}
