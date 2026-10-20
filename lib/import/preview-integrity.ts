/**
 * Pre-commit import integrity: unmapped columns, within-file duplicates,
 * and recoverable field validation. Used by the Import wizard preview and
 * mirrored on the server for authoritative skip decisions.
 */
import { ENTITY_FIELDS, type EntityType, type FieldMapping, type ImportFieldDef } from "@/lib/import/types";
import { parsePackagePriceInput } from "@/lib/packages/constants";

type CsvRow = Record<string, string>;

export type UnmappedColumnReport = {
  /** Headers not mapped to any import field. */
  headers: string[];
  /** Unmapped headers that have at least one non-empty cell. */
  withData: string[];
  /** Unmapped headers that are empty in every row. */
  empty: string[];
};

export type ImportRowDisposition =
  | "ready"
  | "skip_required"
  | "skip_within_file_duplicate"
  | "skip_invalid"
  | "warn_ambiguous_name";

export type ImportRowPreview = {
  rowNumber: number;
  disposition: ImportRowDisposition;
  message: string | null;
  /** When disposition is within-file duplicate, the earlier row number (1-based). */
  duplicateOfRow: number | null;
};

export type ImportPreviewSummary = {
  readyCount: number;
  skipCount: number;
  warnCount: number;
  rows: ImportRowPreview[];
  unmapped: UnmappedColumnReport;
};

/** Headers referenced by the current mapping (non-null selections). */
export function mappedHeaderSet(mapping: FieldMapping): Set<string> {
  const set = new Set<string>();
  for (const col of Object.values(mapping)) {
    if (col) set.add(col);
  }
  return set;
}

export function analyzeUnmappedColumns(
  headers: string[],
  mapping: FieldMapping,
  rows: CsvRow[],
): UnmappedColumnReport {
  const mapped = mappedHeaderSet(mapping);
  const unmapped = headers.filter((h) => h.trim() && !mapped.has(h));
  const withData: string[] = [];
  const empty: string[] = [];
  for (const header of unmapped) {
    const hasData = rows.some((row) => (row[header] ?? "").trim().length > 0);
    if (hasData) withData.push(header);
    else empty.push(header);
  }
  return { headers: unmapped, withData, empty };
}

/**
 * Normalize a calendar date for import. Accepts ISO YYYY-MM-DD and common
 * US M/D/YYYY (or M-D-YYYY). Returns null for blank. Returns { ok:false }
 * when a value is present but not a real calendar date — never invents a day.
 */
export function normalizeImportDate(raw: string):
  | { ok: true; value: string | null }
  | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: null };

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (!isRealYmd(y, m, d)) {
      return { ok: false, message: `Not a real calendar date: ${t}` };
    }
    return { ok: true, value: `${y}-${pad2(m)}-${pad2(d)}` };
  }

  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (us) {
    const m = Number(us[1]);
    const d = Number(us[2]);
    const y = Number(us[3]);
    if (!isRealYmd(y, m, d)) {
      return { ok: false, message: `Not a real calendar date: ${t}` };
    }
    return { ok: true, value: `${y}-${pad2(m)}-${pad2(d)}` };
  }

  return {
    ok: false,
    message: `Unrecognized date "${t}". Use YYYY-MM-DD or M/D/YYYY.`,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isRealYmd(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Currency / amount: blank → null; valid number → string for downstream; invalid → error. */
export function normalizeImportAmount(raw: string):
  | { ok: true; value: string }
  | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: "" };
  const n = parsePackagePriceInput(t);
  if (n == null) return { ok: true, value: "" };
  if (Number.isNaN(n)) {
    return { ok: false, message: `Enter a valid dollar amount (got "${t}").` };
  }
  if (n < 0) {
    return { ok: false, message: "Amount cannot be negative." };
  }
  return { ok: true, value: String(n) };
}

/** Inventory quantity: blank → 0; must be a non-negative integer when present. */
export function normalizeImportQuantity(raw: string):
  | { ok: true; value: string }
  | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: "0" };
  if (!/^\d+$/.test(t)) {
    return { ok: false, message: `Quantity must be a whole number (got "${t}").` };
  }
  return { ok: true, value: t };
}

const VENDOR_PRICING_CANONICAL = new Set(["budget", "mid_range", "premium", "luxury"]);

/**
 * Vendor pricing_tier DB check allows only budget|mid_range|premium|luxury.
 * Spreadsheets often use $ / $$ labels — map those; reject unknown values
 * rather than writing an invalid tier (check constraint → opaque import error).
 */
export function normalizeImportVendorPricingTier(raw: string):
  | { ok: true; value: string }
  | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: "" };
  const lower = t.toLowerCase().replace(/\s+/g, "_");
  if (VENDOR_PRICING_CANONICAL.has(lower)) return { ok: true, value: lower };
  const dollars = t.replace(/\s+/g, "");
  if (dollars === "$") return { ok: true, value: "budget" };
  if (dollars === "$$") return { ok: true, value: "mid_range" };
  if (dollars === "$$$") return { ok: true, value: "premium" };
  if (dollars === "$$$$") return { ok: true, value: "luxury" };
  return {
    ok: false,
    message: `Pricing tier must be budget, mid_range, premium, luxury, or $/$$/$$$/$$$$ (got "${t}").`,
  };
}

function val(row: CsvRow, mapping: FieldMapping, key: string): string {
  const col = mapping[key];
  return col ? (row[col] ?? "").trim() : "";
}

/**
 * Within-file identity for people (clients / leads preview).
 * Email is the only auto-skip key. Blank emails never match each other
 * via an empty-email key — same-name + no email is warn_ambiguous_name.
 */
export function personEmailWithinFileKey(email: string): string | null {
  const e = email.trim().toLowerCase();
  return e ? `email:${e}` : null;
}

export function personNameKey(firstName: string, lastName: string): string | null {
  const f = firstName.trim().toLowerCase();
  const l = lastName.trim().toLowerCase();
  if (!f || !l) return null;
  return `name:${f}|${l}`;
}

/** Vendors: prefer email; else normalized business name (organizations, not people). */
export function vendorWithinFileKey(businessName: string, email: string): string | null {
  const e = email.trim().toLowerCase();
  if (e) return `email:${e}`;
  const name = businessName.trim().toLowerCase().replace(/\s+/g, " ");
  return name ? `biz:${name}` : null;
}

/** Inventory / packages: normalized name. */
export function catalogNameWithinFileKey(name: string): string | null {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  return n ? `name:${n}` : null;
}

function validateMappedDates(
  entity: EntityType,
  row: CsvRow,
  mapping: FieldMapping,
): string | null {
  const dateKeys =
    entity === "couples"
      ? (["eventDate", "endDate"] as const)
      : entity === "leads"
        ? (["eventDate"] as const)
        : [];
  for (const key of dateKeys) {
    const raw = val(row, mapping, key);
    if (!raw) continue;
    const parsed = normalizeImportDate(raw);
    if (!parsed.ok) return parsed.message;
  }
  return null;
}

function validateMappedAmounts(
  entity: EntityType,
  row: CsvRow,
  mapping: FieldMapping,
): string | null {
  if (entity === "leads") {
    const budgetRaw = val(row, mapping, "estimatedBudget");
    if (budgetRaw) {
      const parsed = normalizeImportAmount(budgetRaw);
      if (!parsed.ok) return parsed.message;
    }
    const guestRaw = val(row, mapping, "guestCount");
    if (guestRaw && !/^\d+$/.test(guestRaw)) {
      return `Guest count must be a whole number (got "${guestRaw}").`;
    }
    return null;
  }
  if (entity === "packages") {
    const raw = val(row, mapping, "basePrice");
    if (!raw) return null;
    const parsed = normalizeImportAmount(raw);
    return parsed.ok ? null : parsed.message;
  }
  if (entity === "inventory") {
    const raw = val(row, mapping, "quantity");
    if (!raw) return null;
    const parsed = normalizeImportQuantity(raw);
    return parsed.ok ? null : parsed.message;
  }
  if (entity === "vendors") {
    const raw = val(row, mapping, "pricingTier");
    if (!raw) return null;
    const parsed = normalizeImportVendorPricingTier(raw);
    return parsed.ok ? null : parsed.message;
  }
  if (entity === "couples") {
    const raw = val(row, mapping, "guestCount");
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) {
      return `Guest count must be a whole number (got "${raw}").`;
    }
  }
  return null;
}

/**
 * Classify every row for preview (and for mirroring skip decisions).
 * Does not contact the database — only within-file + local field checks.
 */
export function classifyImportPreview(
  entity: EntityType,
  headers: string[],
  mapping: FieldMapping,
  rows: CsvRow[],
): ImportPreviewSummary {
  const fields: ImportFieldDef[] = ENTITY_FIELDS[entity];
  const requiredKeys = fields.filter((f) => f.required).map((f) => f.key);
  const unmapped = analyzeUnmappedColumns(headers, mapping, rows);

  const emailSeen = new Map<string, number>();
  const nameSeen = new Map<string, number>();
  const catalogSeen = new Map<string, number>();

  const previews: ImportRowPreview[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    const missingRequired = requiredKeys.some((k) => !val(row, mapping, k));
    if (missingRequired) {
      const missing = requiredKeys
        .filter((k) => !val(row, mapping, k))
        .map((k) => fields.find((f) => f.key === k)?.label ?? k);
      previews.push({
        rowNumber,
        disposition: "skip_required",
        message: `Missing required: ${missing.join(", ")}`,
        duplicateOfRow: null,
      });
      continue;
    }

    const dateErr = validateMappedDates(entity, row, mapping);
    if (dateErr) {
      previews.push({
        rowNumber,
        disposition: "skip_invalid",
        message: dateErr,
        duplicateOfRow: null,
      });
      continue;
    }

    const amountErr = validateMappedAmounts(entity, row, mapping);
    if (amountErr) {
      previews.push({
        rowNumber,
        disposition: "skip_invalid",
        message: amountErr,
        duplicateOfRow: null,
      });
      continue;
    }

    // Within-file duplicates
    if (entity === "couples" || entity === "leads") {
      const email = val(row, mapping, "email");
      const first = val(row, mapping, "firstName");
      const last = val(row, mapping, "lastName");
      const emailKey = personEmailWithinFileKey(email);
      if (emailKey) {
        const prior = emailSeen.get(emailKey);
        if (prior != null) {
          previews.push({
            rowNumber,
            disposition: "skip_within_file_duplicate",
            message: `Duplicate of row ${prior} in this file (same email) — will be skipped`,
            duplicateOfRow: prior,
          });
          continue;
        }
        emailSeen.set(emailKey, rowNumber);
      } else {
        const nk = personNameKey(first, last);
        if (nk) {
          const prior = nameSeen.get(nk);
          if (prior != null) {
            previews.push({
              rowNumber,
              disposition: "warn_ambiguous_name",
              message:
                `Same name as row ${prior}, and neither has an email — will attempt import; if a matching client already exists after earlier rows, this row may be skipped`,
              duplicateOfRow: prior,
            });
            // Still counted as ready for the import button — do not auto-skip
            nameSeen.set(nk, rowNumber);
            continue;
          }
          nameSeen.set(nk, rowNumber);
        }
      }
    } else if (entity === "vendors") {
      const key = vendorWithinFileKey(val(row, mapping, "businessName"), val(row, mapping, "email"));
      if (key) {
        const prior = catalogSeen.get(key);
        if (prior != null) {
          previews.push({
            rowNumber,
            disposition: "skip_within_file_duplicate",
            message: `Duplicate of row ${prior} in this file — will be skipped`,
            duplicateOfRow: prior,
          });
          continue;
        }
        catalogSeen.set(key, rowNumber);
      }
    } else if (entity === "inventory" || entity === "packages") {
      const key = catalogNameWithinFileKey(val(row, mapping, "name"));
      if (key) {
        const prior = catalogSeen.get(key);
        if (prior != null) {
          previews.push({
            rowNumber,
            disposition: "skip_within_file_duplicate",
            message: `Duplicate of row ${prior} in this file (same name) — will be skipped`,
            duplicateOfRow: prior,
          });
          continue;
        }
        catalogSeen.set(key, rowNumber);
      }
    }

    previews.push({
      rowNumber,
      disposition: "ready",
      message: null,
      duplicateOfRow: null,
    });
  }

  // Re-classify: warn_ambiguous_name rows are importable
  let readyCount = 0;
  let skipCount = 0;
  let warnCount = 0;
  for (const p of previews) {
    if (p.disposition === "ready") readyCount++;
    else if (p.disposition === "warn_ambiguous_name") {
      readyCount++;
      warnCount++;
    } else {
      skipCount++;
    }
  }

  return { readyCount, skipCount, warnCount, rows: previews, unmapped };
}

/** Apply date/amount normalization onto mapped string fields before commit. */
export function normalizeMappedRowValues(
  entity: EntityType,
  row: CsvRow,
  mapping: FieldMapping,
): { ok: true; values: Record<string, string> } | { ok: false; message: string } {
  const values: Record<string, string> = {};
  const dateKeys =
    entity === "couples"
      ? ["eventDate", "endDate"]
      : entity === "leads"
        ? ["eventDate"]
        : [];
  for (const key of dateKeys) {
    const raw = val(row, mapping, key);
    const parsed = normalizeImportDate(raw);
    if (!parsed.ok) return parsed;
    values[key] = parsed.value ?? "";
  }
  if (entity === "leads") {
    const parsed = normalizeImportAmount(val(row, mapping, "estimatedBudget"));
    if (!parsed.ok) return parsed;
    values.estimatedBudget = parsed.value;
  }
  if (entity === "packages") {
    const parsed = normalizeImportAmount(val(row, mapping, "basePrice"));
    if (!parsed.ok) return parsed;
    values.basePrice = parsed.value;
  }
  if (entity === "inventory") {
    const parsed = normalizeImportQuantity(val(row, mapping, "quantity"));
    if (!parsed.ok) return parsed;
    values.quantity = parsed.value;
  }
  return { ok: true, values };
}
