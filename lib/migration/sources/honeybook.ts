/**
 * Migration Center — the HoneyBook adapter.
 *
 * PHASE 0 VERIFICATION (done before writing this file, not assumed):
 *
 * VERIFIED, from HoneyBook's own help center, cross-referenced across
 * independent articles:
 * - A real "Clients > Contacts > ⋯ > Download spreadsheet" export exists
 *   (help.honeybook.com/en/articles/2650752-download-and-export-your-
 *   contacts-list-from-honeybook), containing "the contact's name, email,
 *   phone number, address, notes, and the date the contact was created."
 * - The name is very likely a single combined field, not separate
 *   first/last columns — two independent, convergent signals: the export
 *   article itself says "name" (singular), and the "Add your contacts,
 *   leads, and existing clients to HoneyBook" article describes adding a
 *   contact by entering "the client name or title," never first/last name
 *   as distinct fields.
 *
 * NOT VERIFIED, deliberately not assumed:
 * - The literal column header text, casing, or order (e.g. "Name" vs.
 *   "Client Name" vs. "Full Name"). Three direct fetch attempts against
 *   HoneyBook's own export article never surfaced literal header text —
 *   the real headers most likely live in a screenshot/embedded table the
 *   article's prose doesn't reproduce. Recognition below is therefore
 *   content-based (does this look like a HoneyBook contacts export at
 *   all), never an assumption of an exact column name or position.
 * - Whether a genuinely stage-aware, per-row lead/client export exists.
 *   HoneyBook's Reports section has separate "Leads" ("breakdown of lead
 *   sources and booking dates via contact forms") and "Clients"
 *   ("high-level breakdown of all clients and total client worth")
 *   reports — but their exact shape is unconfirmed, and the Leads
 *   report's own description reads more like aggregate analytics than a
 *   row-level contact list. No stage-based logic is built on this: per
 *   the governing instruction, an unverified lead is reported, not acted
 *   on. The venue chooses lead vs. client for the whole import up front
 *   (the existing entity-type picker), exactly as generic CSV already
 *   requires — no invented per-row classification.
 *
 * PHASE 1 (shipped first, as its own commit): registered through the
 * existing source_profiles/getSourceAdapter architecture, conservative
 * content-based recognition, normalization delegated entirely to
 * genericCsvAdapter's own proven logic — the exact same safe baseline
 * weven-legacy.ts established.
 *
 * PHASE 2 (this version): the one piece of genuine HoneyBook-specific
 * intelligence the verified facts above actually support — splitting the
 * combined "name" field, since HoneyBook's export doesn't provide
 * separate first/last columns but the canonical model requires them.
 * "System proposes, human confirms uncertainty": an unambiguous split
 * (two words; a recognizable generational suffix) is applied directly. A
 * genuinely ambiguous split (one word; three-or-more words with no
 * suffix) still produces the best-effort proposal, but the record is
 * surfaced through the existing needs_review path rather than silently
 * treated as certain — no new review mechanism, reusing normalizeRow's
 * existing ok:false contract exactly as generic CSV already does for a
 * row it can't make sense of.
 *
 * Neither phase touches session lifecycle, commit, retry, race
 * protection, or Historical Import Mode — a source adapter only ever
 * changes what a row normalizes to, never how a session is orchestrated.
 */
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import type {
  MigrationEntityType,
  NormalizationResult,
  NormalizedClientLike,
  NormalizedLeadLike,
  SourceAdapter,
  SourceRow,
} from "@/lib/migration/types";

/**
 * Conservative, content-based recognition — no exact header name or
 * position is assumed (none is verified). Matches either an explicit
 * self-identifying label (a header literally containing "honeybook"), or
 * the specific field cluster HoneyBook's own export is confirmed to
 * contain: a single combined name column alongside email/phone/address/
 * notes, with no separate first/last name columns at all. That specific
 * combination — full contact detail present, but firstName/lastName both
 * absent — is a genuine, non-generic signal for this source, not present
 * in the field-mapping output of an already-correctly-mapped generic
 * import (which would have firstName/lastName by construction, having
 * been mapped in the existing field-mapping step before reaching here).
 */
function recognizes(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase());
  if (lower.some((h) => h.includes("honeybook"))) return true;
  const hasCombinedName = lower.some((h) => h === "name" || h.includes("client name") || h.includes("full name"));
  const hasNoSplitName = !lower.includes("firstname") && !lower.includes("first name");
  const hasContactCluster = lower.some((h) => h.includes("email")) && lower.some((h) => h.includes("phone")) && lower.some((h) => h.includes("address"));
  return hasCombinedName && hasNoSplitName && hasContactCluster;
}

const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);

/**
 * Best-effort split of a combined name into first/last. Never throws,
 * never drops a row for being hard to split — always returns a proposal,
 * plus a `confident` signal the caller uses to decide whether this record
 * commits directly or needs a human look first.
 */
export function splitName(raw: string): { firstName: string; lastName: string; confident: boolean } {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "", confident: false };

  const parts = trimmed.split(" ");

  if (parts.length === 1) {
    // Single word — nothing to split. Preserve what we have; the other
    // canonical field stays empty rather than duplicating or inventing a
    // last name. Confident: there is no ambiguity in "there's only one word."
    return { firstName: parts[0], lastName: "", confident: true };
  }

  if (parts.length === 2) {
    // The unambiguous, overwhelmingly common case.
    return { firstName: parts[0], lastName: parts[1], confident: true };
  }

  // Three or more parts. A generational suffix at the end ("John Smith
  // Jr") is a confident, recognizable pattern — strip it from the last
  // name rather than folding "Jr" in as if it were part of the surname.
  const last = parts[parts.length - 1];
  if (SUFFIXES.has(last.toLowerCase().replace(/\.$/, ""))) {
    return { firstName: parts[0], lastName: parts.slice(1, -1).join(" "), confident: parts.length === 3 };
  }

  // Reasonable best-effort default for a longer name (a middle name, a
  // hyphenated/multi-word surname, a couple entered as one contact "Jane
  // and John Smith") — first word as first name, everything else as last
  // name. A real guess, not a verified rule, so never marked confident:
  // the record still commits with this proposal, but is surfaced through
  // needs_review rather than treated as certain.
  return { firstName: parts[0], lastName: parts.slice(1).join(" "), confident: false };
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function normalizeRow(row: SourceRow, entityType: MigrationEntityType): NormalizationResult {
  if (entityType === "vendor") {
    // HoneyBook's verified export is a contacts list (people the venue's
    // business talks to), not a vendor/referral-partner directory in our
    // sense — nothing HoneyBook-specific to add. Reuse generic as-is.
    return genericCsvAdapter.normalizeRow(row, entityType);
  }
  if (entityType !== "client" && entityType !== "lead") {
    return { ok: false, error: `HoneyBook import does not yet support "${entityType}" records.` };
  }

  // A row that already carries separate names (e.g. an operator re-mapped
  // columns manually, or this row came from a different file than the
  // rest of the batch) has nothing to split — defer entirely to the
  // proven generic path rather than second-guessing already-good data.
  const alreadySplit = !!(str(row.firstName) || str(row.lastName));
  if (alreadySplit) return genericCsvAdapter.normalizeRow(row, entityType);

  const combinedName = row.name ?? row.clientName ?? row.fullName;
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

  // The split itself never fails the row — even a low-confidence guess
  // still produces a normalized candidate, since withholding a reasonable
  // proposal entirely would mean more manual work for the venue, not
  // less. What changes with confidence is the outcome: a low-confidence
  // split is surfaced through the existing needs_review path (the same
  // ok:false contract every adapter already uses for an unmappable row)
  // rather than auto-approved — "system proposes, human confirms
  // uncertainty," no new review mechanism.
  if (!confident) {
    return {
      ok: false,
      error: `"${trimmedName}" was split as first name "${firstName}", last name "${lastName}" — please confirm this is correct.`,
    };
  }

  return { ok: true, entityType, normalized };
}

export const honeybookAdapter: SourceAdapter = {
  key: "honeybook",
  recognizes,
  normalizeRow,
};
