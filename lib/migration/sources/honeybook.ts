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
 * PHASE 1 (this file): registered through the existing source_profiles/
 * getSourceAdapter architecture, conservative content-based recognition,
 * normalization delegated entirely to genericCsvAdapter's own proven
 * logic — the exact same safe baseline weven-legacy.ts established. No
 * engine change; nothing in session lifecycle, commit, retry, race
 * protection, or Historical Import Mode is touched.
 *
 * PHASE 2 (a separate, later change to this same file): the one piece of
 * genuine HoneyBook-specific intelligence the verified facts above
 * actually support — splitting the combined "name" field, since
 * HoneyBook's export doesn't provide separate first/last columns but the
 * canonical model requires them.
 */
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import type { MigrationEntityType, NormalizationResult, SourceAdapter, SourceRow } from "@/lib/migration/types";

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

function normalizeRow(row: SourceRow, entityType: MigrationEntityType): NormalizationResult {
  return genericCsvAdapter.normalizeRow(row, entityType);
}

export const honeybookAdapter: SourceAdapter = {
  key: "honeybook",
  recognizes,
  normalizeRow,
};
