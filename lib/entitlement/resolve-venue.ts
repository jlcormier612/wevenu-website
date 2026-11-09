/**
 * Authoritative venue resolution for SaaS entitlement sync.
 *
 * Prefer explicit venue id, then Stripe subscription id, then an unambiguous
 * Stripe Customer match. Never select a venue by purchaser email alone — that
 * is unsafe when one purchaser owns multiple venues.
 */

export type VenueResolution =
  | {
      ok: true;
      venueId: string;
      how: "venue_id" | "subscription_id" | "customer_id_unique";
    }
  | {
      ok: false;
      reason: "not_found" | "ambiguous";
      how: string;
      candidateIds: string[];
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVenueUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value.trim()));
}

/**
 * Pure decision over already-fetched candidate id lists.
 * Callers must query by subscription / customer; email is intentionally absent.
 */
export function resolveVenueFromCandidates(input: {
  explicitVenueId?: string | null;
  /** Venues whose saas_stripe_subscription_id matches the event. */
  subscriptionMatches?: string[];
  /** Venues whose saas_stripe_customer_id matches the event. */
  customerMatches?: string[];
}): VenueResolution {
  const explicit = input.explicitVenueId?.trim() || "";
  if (explicit && isVenueUuid(explicit)) {
    return { ok: true, venueId: explicit, how: "venue_id" };
  }

  const bySub = uniqueIds(input.subscriptionMatches);
  if (bySub.length === 1) {
    return { ok: true, venueId: bySub[0]!, how: "subscription_id" };
  }
  if (bySub.length > 1) {
    return {
      ok: false,
      reason: "ambiguous",
      how: "subscription_id",
      candidateIds: bySub,
    };
  }

  const byCustomer = uniqueIds(input.customerMatches);
  if (byCustomer.length === 1) {
    return { ok: true, venueId: byCustomer[0]!, how: "customer_id_unique" };
  }
  if (byCustomer.length > 1) {
    return {
      ok: false,
      reason: "ambiguous",
      how: "customer_id",
      candidateIds: byCustomer,
    };
  }

  return {
    ok: false,
    reason: "not_found",
    how: "no_authoritative_match",
    candidateIds: [],
  };
}

function uniqueIds(ids: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids ?? []) {
    const id = raw?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
