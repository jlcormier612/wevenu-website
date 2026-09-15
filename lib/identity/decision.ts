/**
 * Venue-controlled customer identity.
 *
 * Matching signals may suggest a possible existing customer. They do not
 * establish that two records are the same person. Only an explicit venue
 * decision (or a safe same-email + same primary name returning match on
 * unattended intake) may reuse a relationship.
 */
import type { DuplicateCandidate } from "@/lib/leads/duplicate-detection";

export type IdentityDecision =
  | { action: "use_existing"; relationshipId: string }
  | { action: "create_new" };

export function identityRpcFields(decision?: IdentityDecision | null): {
  relationshipId?: string;
  createNewRelationship?: boolean;
} {
  if (!decision) return {};
  if (decision.action === "create_new") return { createNewRelationship: true };
  return { relationshipId: decision.relationshipId, createNewRelationship: false };
}

function norm(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/** Same primary first+last — the only unattended reuse allowed (true returning customer). */
export function samePrimaryName(
  a: { firstName: string; lastName: string },
  b: { firstName: string | null; lastName: string | null },
): boolean {
  const af = norm(a.firstName);
  const al = norm(a.lastName);
  const bf = norm(b.firstName);
  const bl = norm(b.lastName);
  return Boolean(af && al && bf && bl && af === bf && al === bl);
}

export function requireIdentityDecision(
  matches: DuplicateCandidate[],
  decision?: IdentityDecision | null,
): { ok: true } | { ok: false; matches: DuplicateCandidate[] } {
  if (matches.length === 0) return { ok: true };
  if (decision?.action === "create_new") return { ok: true };
  if (decision?.action === "use_existing" && decision.relationshipId) return { ok: true };
  return { ok: false, matches };
}
