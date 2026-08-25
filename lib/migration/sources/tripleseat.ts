/**
 * Migration Center — the Tripleseat adapter (file-based Phase 1 only).
 *
 * VERIFIED (see the Tripleseat Source-Readiness Report — the live
 * `lead_schema.json`/`contact_schema.json`/`account_schema.json` fetched
 * directly from `api.tripleseat.com/v1/`, plus Tripleseat's own "Contact/
 * Account Imports" and "Lead Imports" help articles):
 * - The Contact object's canonical shape has SEPARATE `first_name`/
 *   `last_name` fields — not combined, confirmed directly from the live
 *   API schema, not inferred.
 * - Tripleseat's own Contact/Account import format additionally supports
 *   `Full_name` as an explicit alternate header, usable in place of
 *   first_name/last_name — a real, confirmed convenience option, not the
 *   canonical shape.
 * - Lead records carry a real, structured `lead_source`, and outcome
 *   pointers (`converted_at`, `turned_down_at`/`turned_down_reason`,
 *   `account_id`/`contact_id`/`event_id`/`booking_id`) — none of which
 *   this adapter acts on yet (see NOT IN SCOPE below).
 * - Tripleseat's own Lead import format requires only one of email/phone,
 *   not both.
 *
 * NOT VERIFIED / NOT IN SCOPE for this phase, deliberately:
 * - The literal downloaded-export column order/casing a real customer
 *   would see — the evidence above is the live API schema and the
 *   import-template documentation, not a confirmed export file.
 * - Any API/OAuth connection — this is a file-based adapter only.
 * - Booking → Event migration, or reconstructing pipeline/stage from
 *   `converted_at`/`turned_down_at` — real, verified fields, but acting
 *   on them is a distinct, larger decision this phase doesn't make.
 * - Whether a Tripleseat "Account" represents a client household or a
 *   vendor/referral relationship in our sense — genuinely ambiguous from
 *   the schema alone, so vendor rows get no Tripleseat-specific handling
 *   at all here (reuse generic, unchanged).
 *
 * Tripleseat is a named, optimized path — not an exclusive club. This
 * adapter adds intelligence only where the evidence above actually
 * supports it; every source without its own adapter still gets the full,
 * unpenalized generic CSV path (docs/migration-cutover-architecture.md's
 * own founding principle, restated by this product decision explicitly).
 */
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import { splitName } from "@/lib/migration/sources/honeybook";
import type { MigrationEntityType, NormalizationResult, NormalizedClientLike, NormalizedLeadLike, SourceAdapter, SourceRow } from "@/lib/migration/types";

/**
 * Conservative, content-based recognition. Tripleseat's canonical shape
 * (separate first_name/last_name) looks like ordinary generic CSV on its
 * own — matching on first_name/last_name/email alone would be far too
 * broad and would mislabel unrelated sources. Recognition therefore looks
 * for genuinely Tripleseat-specific signals: an explicit label, the
 * confirmed `Full_name` import convenience header, or fields verified
 * only on Tripleseat's own object schema (`account_id`, `lead_source`,
 * `contact_type`) alongside ordinary contact fields.
 */
function recognizes(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase());
  if (lower.some((h) => h.includes("tripleseat"))) return true;

  const hasDistinctiveField = lower.some((h) => ["account_id", "lead_source", "contact_type"].includes(h));
  const hasContactCluster = lower.some((h) => h.includes("email")) && lower.some((h) => h.includes("phone"));
  if (hasDistinctiveField && hasContactCluster) return true;

  // The confirmed Full_name convenience header, alongside the contact
  // cluster — on its own "full name" isn't distinctive (HoneyBook-shaped
  // files also use it), so this only counts combined with an account_id/
  // lead_source/contact_type signal above, or the exact literal casing
  // Tripleseat's own documentation uses ("Full_name", underscore, capital F).
  return lower.includes("full_name") && hasContactCluster;
}

function normalizeRow(row: SourceRow, entityType: MigrationEntityType): NormalizationResult {
  if (entityType === "vendor") {
    // No verified evidence distinguishes a Tripleseat Account as a vendor/
    // referral relationship vs. a client household — out of scope by
    // explicit product decision, not an oversight. Reuse generic as-is.
    return genericCsvAdapter.normalizeRow(row, entityType);
  }
  if (entityType !== "client" && entityType !== "lead") {
    return { ok: false, error: `Tripleseat import does not yet support "${entityType}" records.` };
  }

  // Tripleseat's canonical shape is already-separate first_name/last_name
  // (confirmed from the live API schema) — the overwhelmingly likely case
  // for a real export. Nothing to split; defer entirely to the proven
  // generic path exactly like every other adapter does for an
  // already-split row.
  const str = (v: unknown) => { const s = v != null ? String(v).trim() : ""; return s === "" ? null : s; };
  const alreadySplit = !!(str(row.firstName) || str(row.lastName));
  if (alreadySplit) return genericCsvAdapter.normalizeRow(row, entityType);

  // Only the confirmed Full_name convenience shape remains. Reuse
  // HoneyBook's own best-effort split + confidence/review contract
  // exactly — not a new pattern, per the explicit product decision.
  const combinedName = row.name ?? row.fullName;
  const trimmedName = combinedName != null ? String(combinedName).trim() : "";
  if (!trimmedName) {
    return { ok: false, error: "Missing a name — every record needs at least one identifiable person." };
  }

  const { firstName, lastName, confident } = splitName(trimmedName);
  const base = {
    firstName,
    lastName,
    partnerFirstName: null,
    partnerLastName: null,
    email: str(row.email),
    phone: str(row.phone),
    eventDate: str(row.eventDate),
    eventType: str(row.eventType),
    guestCount: str(row.guestCount),
    notes: str(row.internalNotes) ?? str(row.notes),
    sourceId: str(row.sourceId) ?? str(row.id) ?? str(row.recordId),
  };

  const normalized: NormalizedClientLike | NormalizedLeadLike = entityType === "lead"
    ? { ...base, inquiryMessage: str(row.inquiryMessage), estimatedBudget: str(row.estimatedBudget) }
    : base;

  if (!confident) {
    return {
      ok: false,
      error: `"${trimmedName}" was split as first name "${firstName}", last name "${lastName}" — please confirm this is correct.`,
    };
  }

  return { ok: true, entityType, normalized };
}

export const tripleseatAdapter: SourceAdapter = {
  key: "tripleseat",
  recognizes,
  normalizeRow,
};
