/**
 * Sandbox demo / disposable CRM isolation.
 *
 * Known demo venue-app IDs (and their Stripe test customers) stay synchronizable
 * but are stamped non-operational so dashboards, MRR, conversions, and unread
 * badges stay accurate. This is an explicit allowlist — never a blanket
 * "exclude all Sandbox" rule. New non-registry Sandbox venues remain operational.
 *
 * Disposable acceptance fixtures use venue name `[DISPOSABLE-…]`, email
 * `+disposable@`, or `meta.disposable` / `crmRole: "disposable"`.
 */

export type CrmRole = "customer" | "sandbox_demo" | "disposable";

/** Jen's Fancy Venue + the 9 billing-linked Sandbox theater venues (CRM-READINESS). */
export const SANDBOX_DEMO_VENUE_IDS: ReadonlySet<string> = new Set([
  "a415ac52-cd74-42a6-8df7-7a8f6e71d080", // Jen's Fancy Venue
  "af2d6aa1-0eb2-4e65-aa6f-c066cb71a4b6", // Juniper Valley Farm
  "ebfeb3e7-cb95-44a4-9cbd-e0b2f2ff3803", // Lulu Lodge
  "f2e3908a-3b54-43b2-86fd-d2439641b236", // Lulu's Lakeview Lodge
  "05f16a15-1752-4855-8a3b-aad5c593d8d9", // Meadowbrook Valley Venue
  "d466141a-23f4-4045-9eb4-76e79699bcce", // Rebecca’s Rocking Events
  "9136fc74-8b52-4525-b838-591ca6513864", // Sally Sunshine Events
  "9fcd858e-5d62-4bc4-b365-cec4e45809a3", // Sweet Daisy Barn (venue row name may drift)
  "fb4f41cc-5b1f-4131-9136-2e0d909a100c", // The Willow Grove
  "5f3b43f8-0c5d-43df-ae8a-5cd59806d30d", // Willow Lodge
]);

/** Stripe test customers tied to the demo registry (ingest without venue id). */
export const SANDBOX_DEMO_STRIPE_CUSTOMER_IDS: ReadonlySet<string> = new Set([
  "cus_VOQ2dBHYRsuMBS",
  "cus_VOVhfjwYy5DU5s",
  "cus_VOSRqnshsUafgF",
  "cus_VQIkgmZdeRFsVZ",
  "cus_VVsBSb5SkR6e3F",
  "cus_V6NKmV0cnVW5OH",
  "cus_V68v2s7yynhfap",
  "cus_Vbal3RdUTzZhVk",
  "cus_VO6DdAVvEB1mKP",
]);

export const DISPOSABLE_VENUE_NAME_RE = /^\[DISPOSABLE-[^\]]+\]/i;

export type IsolationHints = {
  productVenueId?: string | null;
  stripeCustomerId?: string | null;
  venueName?: string | null;
  email?: string | null;
  /** Explicit meta.disposable from callers / fixtures. */
  disposable?: boolean | null;
};

export type IsolationClassifiable = {
  crmRole?: CrmRole | null;
  productSync?: { venueId?: string | null } | null;
  stripeCustomerId?: string | null;
  venue?: { name?: string | null } | null;
  owner?: { email?: string | null } | null;
  meta?: Record<string, string | number | boolean | null> | null;
};

export function isSandboxDemoVenueId(venueId: string | null | undefined): boolean {
  const id = venueId?.trim();
  return Boolean(id && SANDBOX_DEMO_VENUE_IDS.has(id));
}

export function isSandboxDemoStripeCustomerId(
  customerId: string | null | undefined,
): boolean {
  const id = customerId?.trim();
  return Boolean(id && SANDBOX_DEMO_STRIPE_CUSTOMER_IDS.has(id));
}

export function isDisposableVenueName(name: string | null | undefined): boolean {
  return Boolean(name?.trim() && DISPOSABLE_VENUE_NAME_RE.test(name.trim()));
}

export function isDisposableEmail(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase() || "";
  return e.includes("+disposable@") || e.endsWith("+disposable@hellotocheers.com");
}

/**
 * Resolve classification from explicit role + registry + disposable markers.
 * Disposable wins over demo (fixtures may target a demo venue id briefly).
 */
export function resolveCrmRole(
  relationship: IsolationClassifiable,
  hints?: IsolationHints,
): CrmRole {
  if (
    relationship.crmRole === "disposable" ||
    hints?.disposable === true ||
    relationship.meta?.disposable === true ||
    isDisposableVenueName(hints?.venueName ?? relationship.venue?.name) ||
    isDisposableEmail(hints?.email ?? relationship.owner?.email)
  ) {
    return "disposable";
  }

  if (relationship.crmRole === "sandbox_demo") {
    return "sandbox_demo";
  }

  const venueId =
    hints?.productVenueId?.trim() ||
    relationship.productSync?.venueId?.trim() ||
    "";
  const stripeId =
    hints?.stripeCustomerId?.trim() ||
    relationship.stripeCustomerId?.trim() ||
    "";

  if (isSandboxDemoVenueId(venueId) || isSandboxDemoStripeCustomerId(stripeId)) {
    return "sandbox_demo";
  }

  return relationship.crmRole === "customer" ? "customer" : "customer";
}

/** Operational = contributes to dashboards, MRR, conversions, unread ops badges. */
export function isOperationalRelationship(
  relationship: IsolationClassifiable,
  hints?: IsolationHints,
): boolean {
  const role = resolveCrmRole(relationship, hints);
  return role === "customer";
}

/**
 * Stamp crmRole on a live relationship. Never clears a stronger disposable stamp.
 * Sync/ingest still records events — this only classifies for reporting.
 */
export function stampCrmIsolation<T extends IsolationClassifiable>(
  relationship: T,
  hints?: IsolationHints,
): T {
  const next = resolveCrmRole(relationship, hints);
  if (relationship.crmRole === "disposable" && next !== "disposable") {
    return relationship;
  }
  if (relationship.crmRole !== next) {
    relationship.crmRole = next;
  }
  return relationship;
}

export function filterOperationalRelationships<T extends IsolationClassifiable>(
  relationships: readonly T[],
): T[] {
  return relationships.filter((r) => isOperationalRelationship(r));
}

export function operationalRelationshipIdSet(
  relationships: readonly IsolationClassifiable[],
): Set<string> {
  const ids = new Set<string>();
  for (const r of relationships) {
    if (isOperationalRelationship(r) && "id" in r && typeof (r as { id?: unknown }).id === "string") {
      ids.add((r as { id: string }).id);
    }
  }
  return ids;
}

/** Subscriptions / tasks / etc. whose parent relationship is operational. */
export function filterByOperationalRelationshipId<
  T extends { relationshipId?: string | null },
>(rows: readonly T[], operationalIds: ReadonlySet<string>): T[] {
  return rows.filter((row) => {
    const id = row.relationshipId?.trim();
    if (!id) return false;
    return operationalIds.has(id);
  });
}

/**
 * Documented disposable fixture contract for acceptance scripts.
 * Create with these markers; tear down by crmRole/disposable or name prefix.
 */
export const DISPOSABLE_FIXTURE_GUIDE = {
  venueNamePrefix: "[DISPOSABLE-{ticket}] ",
  emailLocalPartSuffix: "+disposable@",
  crmRole: "disposable" as const,
  metaFlag: { disposable: true as const },
} as const;
