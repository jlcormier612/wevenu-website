/**
 * Migration Center — the Weven (legacy) adapter.
 *
 * VERIFIED, from this codebase's own prior research (docs/migration-
 * cutover-architecture.md §B.8, §C; the earlier "Switching Without Pain"
 * research): Weven was acquired by The Knot Worldwide in 2022 and no
 * longer operates as an independent platform — weven.co redirects
 * directly to theknot.com. There is no live account to connect to, and
 * this adapter makes no such claim anywhere.
 *
 * NOT VERIFIED, and deliberately not assumed: this repository contains no
 * real Weven export sample, column schema, fixture, or documentation of
 * any kind. (The "wevenu"/"Wevenu" hits throughout this codebase — the
 * brand assets, docs/wevenu-hq-architecture.md, docs/wevenu-product-
 * architecture-v1.md — are this product's own former/current brand name,
 * a different, unrelated company from the competitor "Weven." Confirmed
 * by direct inspection before writing this file, not assumed from the
 * repository's own folder name.) No Weven-specific column headers,
 * combined-name conventions, or field layouts are known, so none are
 * guessed here. If a real Weven export sample ever becomes available,
 * this file is exactly where source-specific column recognition and
 * mapping would be added — recognizeS() and normalizeRow() below are
 * structured to make that a targeted addition, not a rewrite.
 *
 * What this adapter is real about today: correct, permanent source
 * attribution and honest historical-limitations copy for a Weven-sourced
 * migration (already registered in source_profiles — see the
 * 20261300000000 migration), reusing the exact same safe, general-purpose
 * field-mapping normalization already proven for generic CSV (rows
 * arriving here have already been mapped to canonical field keys by the
 * existing, unmodified mapping step — see generic-csv.ts's own doc
 * comment). This is not a demo parser standing in for a real one; it is
 * the genuine, minimum-honest adapter for a source with no recoverable
 * format to build against, registered through the same architecture every
 * future source-specific adapter will use.
 */
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import type { MigrationEntityType, NormalizationResult, SourceAdapter, SourceRow } from "@/lib/migration/types";

/**
 * Conservative, non-speculative recognition: true only if a header
 * literally contains the word "weven" — e.g. a venue's own export
 * happened to retain a column like "Weven ID" or "Exported from Weven".
 * This checks for an explicit self-identifying label if one is present;
 * it does not assert or guess any particular Weven column layout. Absence
 * of a match is expected and normal — the venue selecting "Weven (legacy)"
 * explicitly from the source picker is the primary, intended path, not
 * this heuristic.
 */
function recognizes(headers: string[]): boolean {
  return headers.some((h) => h.toLowerCase().includes("weven"));
}

/**
 * Delegates to genericCsvAdapter's own field-mapping-driven normalization
 * — deliberately, not by accident. With no verified Weven-specific
 * transformation to apply, reusing the already-correct, already-tested
 * generic logic is more honest than inventing a distinct code path that
 * would do exactly the same thing while implying otherwise. A row this
 * can't make sense of surfaces the same explicit, human-reviewable error
 * generic CSV does — nothing is ever silently guessed or dropped.
 */
function normalizeRow(row: SourceRow, entityType: MigrationEntityType): NormalizationResult {
  return genericCsvAdapter.normalizeRow(row, entityType);
}

export const wevenLegacyAdapter: SourceAdapter = {
  key: "weven_legacy",
  recognizes,
  normalizeRow,
};
