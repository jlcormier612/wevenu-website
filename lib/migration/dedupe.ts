/**
 * Migration Center — duplicate & conflict strategy (docs/migration-cutover-
 * architecture.md §B.4).
 *
 * Reuses the existing exact-match functions as-is for the exact tier —
 * they're correct and require no changes. Adds a "likely match" tier only
 * where the architecture audit found a real gap: vendors, whose only
 * existing check is exact business-name-or-email `ilike`, with no
 * normalized/fuzzy signal at all. Every `conflict`/`duplicate_likely`
 * outcome is surfaced for an explicit human decision — this module never
 * auto-merges anything.
 */
import * as clientsRepo from "@/lib/clients/repository";
import * as leadsRepo from "@/lib/leads/repository";
import * as vendorsRepo from "@/lib/vendors/repository";
import type { AnyDbClient } from "@/lib/lead-intake/types";
import type {
  MatchType,
  MigrationEntityType,
  NormalizedClientLike,
  NormalizedVendorLike,
} from "@/lib/migration/types";

export type DedupeResult = {
  matchType: MatchType;
  matchedEntityId: string | null;
  matchConfidence: number | null;
};

const NO_MATCH: DedupeResult = { matchType: "none", matchedEntityId: null, matchConfidence: null };

/** Loose normalization for the vendor "likely match" signal — lowercase, strip anything that isn't a letter or digit. Deliberately not applied to the exact-match tiers above, which must stay precise. */
function looseKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Repeat-import short-circuit (§B.4): a prior *committed* record for this
 * venue with the same source-supplied record id is an exact match,
 * cheaper and more precise than re-deriving name/email matching — and the
 * closest this system gets to true idempotency for a source whose export
 * carries stable ids. Sources without one (most CSV exports) simply never
 * hit this branch and fall through to the entity-level checks below.
 */
export async function findBySourceId(
  client: AnyDbClient, venueId: string, sourceId: string | null | undefined,
): Promise<{ recordId: string; createdEntityId: string | null } | null> {
  if (!sourceId) return null;
  // Filtered client-side on normalized_payload.sourceId rather than a
  // jsonb-path PostgREST filter — this stays correct regardless of key
  // casing/quoting edge cases, and committed-record volume per venue is
  // bounded, not the kind of scale that needs a single indexed query here.
  // The partial index on (venue_id, normalized_payload->>'sourceId') still
  // exists for a future version of this check to use directly.
  const { data } = await client
    .from("migration_records")
    .select("id, created_entity_id, normalized_payload")
    .eq("venue_id", venueId)
    .eq("status", "committed")
    .limit(500);
  const rows = (data ?? []) as { id: string; created_entity_id: string | null; normalized_payload: Record<string, unknown> | null }[];
  const match = rows.find((r) => r.normalized_payload?.sourceId === sourceId);
  if (!match) return null;
  return { recordId: match.id, createdEntityId: match.created_entity_id };
}

export async function dedupeClientLike(
  client: AnyDbClient, venueId: string, normalized: NormalizedClientLike,
): Promise<DedupeResult> {
  const bySource = await findBySourceId(client, venueId, normalized.sourceId);
  if (bySource?.createdEntityId) {
    return { matchType: "exact", matchedEntityId: bySource.createdEntityId, matchConfidence: 100 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const match = await clientsRepo.findActiveDuplicateClient(
    client as any, venueId, normalized.email ?? "", normalized.firstName, normalized.lastName,
  );
  if (match) return { matchType: "exact", matchedEntityId: match.id, matchConfidence: 100 };
  return NO_MATCH;
}

export async function dedupeLeadLike(
  client: AnyDbClient, venueId: string, normalized: NormalizedClientLike,
): Promise<DedupeResult> {
  const bySource = await findBySourceId(client, venueId, normalized.sourceId);
  if (bySource?.createdEntityId) {
    return { matchType: "exact", matchedEntityId: bySource.createdEntityId, matchConfidence: 100 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const match = await leadsRepo.findActiveDuplicate(
    client as any, venueId, normalized.email ?? "", normalized.firstName, normalized.lastName,
  );
  if (match) return { matchType: "exact", matchedEntityId: match.id, matchConfidence: 100 };
  return NO_MATCH;
}

/**
 * Vendors: the sharpest gap the architecture audit found. The existing
 * findActiveDuplicateVendor is exact-match only (business name OR email,
 * ilike) — reused here as the exact tier — with a new normalized
 * business-name comparison added as a "likely match" tier, surfaced for
 * review, never auto-merged. Deliberately does not attempt cross-venue
 * vendor identity reconciliation (fusing two different venues' vendor
 * lists is a materially different, riskier feature, out of scope here).
 */
export async function dedupeVendor(
  client: AnyDbClient, venueId: string, normalized: NormalizedVendorLike,
): Promise<DedupeResult> {
  const bySource = await findBySourceId(client, venueId, normalized.sourceId);
  if (bySource?.createdEntityId) {
    return { matchType: "exact", matchedEntityId: bySource.createdEntityId, matchConfidence: 100 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exact = await vendorsRepo.findActiveDuplicateVendor(
    client as any, venueId, normalized.businessName, normalized.email ?? "",
  );
  if (exact) return { matchType: "exact", matchedEntityId: exact.id, matchConfidence: 100 };

  // Likely-match tier: normalized business name, scoped to this venue's
  // own active vendor relationships only.
  const targetKey = looseKey(normalized.businessName);
  if (targetKey.length >= 3) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (client as any)
      .from("venue_vendor_relationships")
      .select("vendor_id, vendors!inner(id, business_name)")
      .eq("venue_id", venueId)
      .neq("status", "inactive")
      .limit(200);
    const candidates = (data ?? []) as { vendor_id: string; vendors: { id: string; business_name: string } }[];
    for (const c of candidates) {
      if (looseKey(c.vendors.business_name) === targetKey) {
        return { matchType: "likely", matchedEntityId: c.vendor_id, matchConfidence: 75 };
      }
    }
  }

  return NO_MATCH;
}

export async function dedupe(
  client: AnyDbClient, venueId: string, entityType: MigrationEntityType, normalized: Record<string, unknown>,
): Promise<DedupeResult> {
  if (entityType === "client") return dedupeClientLike(client, venueId, normalized as NormalizedClientLike);
  if (entityType === "lead") return dedupeLeadLike(client, venueId, normalized as NormalizedClientLike);
  if (entityType === "vendor") return dedupeVendor(client, venueId, normalized as NormalizedVendorLike);
  // Operational rows: sourceId short-circuit only (no fuzzy merge).
  const sourceId = (normalized as { sourceId?: string | null }).sourceId;
  const bySource = await findBySourceId(client, venueId, sourceId);
  if (bySource?.createdEntityId) {
    return { matchType: "exact", matchedEntityId: bySource.createdEntityId, matchConfidence: 100 };
  }
  return NO_MATCH;
}
