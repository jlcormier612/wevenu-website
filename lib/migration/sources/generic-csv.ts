/**
 * Migration Center — the generic CSV/spreadsheet adapter.
 *
 * Rows arriving here have already had their raw column headers mapped to
 * canonical field keys (lib/import/types.ts's ENTITY_FIELDS vocabulary) by
 * the existing, unmodified field-mapping step (components/settings/
 * import-wizard.tsx's StepMapFields, optionally assisted by lib/luv/
 * import-assist.ts) — this file does not reimplement column-header
 * guessing. Its job is the narrower one a source adapter actually owns:
 * light value coercion and reshaping into the normalized candidate shape,
 * with nothing dropped silently — a row this adapter can't make sense of
 * becomes an explicit ok:false, never a swallowed exception.
 *
 * This is also the functional fallback for every source without a real
 * column-signature profile yet (The Knot, WeddingWire, Planning Pod,
 * HoneyBook, Weven legacy) — see lib/migration/source-profiles.ts.
 */
import type {
  MigrationEntityType,
  NormalizationResult,
  NormalizedClientLike,
  NormalizedLeadLike,
  NormalizedVendorLike,
  SourceAdapter,
  SourceRow,
} from "@/lib/migration/types";

function str(row: SourceRow, key: string): string | null {
  const v = row[key];
  if (v == null) return null;
  const trimmed = String(v).trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeClientLike(row: SourceRow): NormalizedClientLike & { ok: true } | { ok: false; error: string } {
  const firstName = str(row, "firstName");
  const lastName = str(row, "lastName");
  if (!firstName || !lastName) {
    return { ok: false, error: "Missing a first and last name — every record needs at least one identifiable person." };
  }
  return {
    ok: true,
    firstName,
    lastName,
    partnerFirstName: str(row, "partnerFirstName"),
    partnerLastName: str(row, "partnerLastName"),
    email: str(row, "email"),
    phone: str(row, "phone"),
    eventDate: str(row, "eventDate"),
    eventType: str(row, "eventType"),
    guestCount: str(row, "guestCount"),
    notes: str(row, "internalNotes") ?? str(row, "notes"),
    sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
  };
}

function normalizeRow(row: SourceRow, entityType: MigrationEntityType): NormalizationResult {
  if (entityType === "client") {
    const r = normalizeClientLike(row);
    if (!r.ok) return r;
    const { ok, ...normalized } = r;
    return { ok: true, entityType, normalized };
  }

  if (entityType === "lead") {
    const r = normalizeClientLike(row);
    if (!r.ok) return r;
    const { ok, ...base } = r;
    const normalized: NormalizedLeadLike = {
      ...base,
      inquiryMessage: str(row, "inquiryMessage"),
      estimatedBudget: str(row, "estimatedBudget"),
    };
    return { ok: true, entityType, normalized };
  }

  if (entityType === "vendor") {
    const businessName = str(row, "businessName");
    if (!businessName) {
      return { ok: false, error: "Missing a business name — every vendor record needs one." };
    }
    const normalized: NormalizedVendorLike = {
      businessName,
      category: str(row, "category"),
      contactName: str(row, "contactName"),
      email: str(row, "email"),
      phone: str(row, "phone"),
      websiteUrl: str(row, "websiteUrl"),
      notes: str(row, "notes"),
      sourceId: str(row, "sourceId") ?? str(row, "id") ?? str(row, "recordId"),
    };
    return { ok: true, entityType, normalized };
  }

  return { ok: false, error: `Generic CSV import does not yet support "${entityType}" records.` };
}

export const genericCsvAdapter: SourceAdapter = {
  key: "generic_csv",
  // Always matches — the deliberate fallback every other source falls back
  // to until it has a real column-signature profile.
  recognizes: () => true,
  normalizeRow,
};
