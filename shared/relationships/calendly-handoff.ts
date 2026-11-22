/**
 * Opaque Calendly scheduling handoff tokens.
 *
 * Minted when a visitor submits the HTC walkthrough intake form, passed to
 * Calendly as utm_content, then resolved on invitee.created / canceled so the
 * booking attaches to the originating venue relationship — not email alone.
 *
 * Tokens are random opaque strings (not relationship ids). Lookup is via
 * timeline event meta.calendlyHandoffToken.
 */

import { randomUUID } from "crypto";

import { loadLiveStore } from "./store";
import type { FindOrCreateResult } from "./service";

export const CALENDLY_HANDOFF_META_KEY = "calendlyHandoffToken";
export const CALENDLY_HANDOFF_UTM_SOURCE = "htc_website";
export const CALENDLY_HANDOFF_UTM_MEDIUM = "walkthrough_intake";

/** Opaque token safe for Calendly utm_content (≤255 chars). */
export function mintCalendlyHandoffToken(): string {
  return `htc_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function isCalendlyHandoffToken(value: string | null | undefined): boolean {
  const token = value?.trim() || "";
  return /^htc_[a-f0-9]{24}$/i.test(token);
}

/**
 * Resolve the relationship that minted this handoff token.
 * Returns null when missing/invalid — caller must use provisional fallback.
 */
export async function findRelationshipByCalendlyHandoffToken(
  token: string | null | undefined,
): Promise<FindOrCreateResult | null> {
  const handoff = token?.trim() || "";
  if (!isCalendlyHandoffToken(handoff)) return null;

  const store = await loadLiveStore();
  const prior = store.timelineEvents.find(
    (event) =>
      (event.type === "walkthrough_requested" ||
        event.type === "walkthrough_scheduled") &&
      String(event.meta?.[CALENDLY_HANDOFF_META_KEY] ?? "") === handoff,
  );
  if (!prior) return null;

  const relationship = store.relationships.find(
    (row) => row.id === prior.relationshipId,
  );
  if (!relationship) return null;
  return { relationship, created: false };
}
