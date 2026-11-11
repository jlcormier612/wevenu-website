/**
 * Resolve the CRM Relationship for a Stripe subscription event.
 *
 * Prefer stripeSubscriptionId. Fall back to stripeCustomerId only when exactly
 * one Relationship owns that Customer. Never use email. Ambiguous matches fail
 * closed (null) so callers can sync with subscription id alone or skip CRM
 * side-effects rather than mutating the wrong venue.
 */

export type RelationshipStripeRef = {
  id: string;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
};

export type SubscriptionRelationshipResolution<T extends RelationshipStripeRef> =
  | { ok: true; relationship: T; how: "subscription_id" | "customer_id_unique" }
  | {
      ok: false;
      reason: "not_found" | "ambiguous";
      how: string;
      candidateIds: string[];
    };

export function resolveRelationshipForSubscription<T extends RelationshipStripeRef>(
  relationships: T[],
  input: {
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
  },
): SubscriptionRelationshipResolution<T> {
  const subId = input.stripeSubscriptionId?.trim() || "";
  if (subId) {
    const bySub = relationships.filter(
      (r) => (r.stripeSubscriptionId || "").trim() === subId,
    );
    if (bySub.length === 1) {
      return {
        ok: true,
        relationship: bySub[0]!,
        how: "subscription_id",
      };
    }
    if (bySub.length > 1) {
      return {
        ok: false,
        reason: "ambiguous",
        how: "subscription_id",
        candidateIds: bySub.map((r) => r.id),
      };
    }
  }

  const customerId = input.stripeCustomerId?.trim() || "";
  if (customerId) {
    const byCustomer = relationships.filter(
      (r) => (r.stripeCustomerId || "").trim() === customerId,
    );
    if (byCustomer.length === 1) {
      return {
        ok: true,
        relationship: byCustomer[0]!,
        how: "customer_id_unique",
      };
    }
    if (byCustomer.length > 1) {
      return {
        ok: false,
        reason: "ambiguous",
        how: "customer_id",
        candidateIds: byCustomer.map((r) => r.id),
      };
    }
  }

  return {
    ok: false,
    reason: "not_found",
    how: "no_authoritative_match",
    candidateIds: [],
  };
}
