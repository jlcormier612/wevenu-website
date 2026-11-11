/**
 * Historical / bulk import integrity — not live lead capture.
 *
 * Duplicate-check failures must fail closed (do not create).
 * Imports must not proceed without a durable import_batches row.
 */
import type { ImportResult, ImportRowError } from "@/lib/import/types";

export const IMPORT_DUPLICATE_CHECK_FAILED =
  "Could not check whether this row already exists in Hello to Cheers, so it was not imported.";

export const IMPORT_BATCH_REQUIRED =
  "Could not record this import in history, so nothing was created. Try again.";

export const IMPORT_BATCH_RECORD_NOT_CREATED =
  "Could not record this import in history, so this record was not created. Try again.";

export const IMPORT_BATCH_ASSOCIATION_FAILED =
  "This row was created but could not be recorded in import history, so it was removed. Try again.";

export const IMPORT_BATCH_ASSOCIATION_UNTRACKED =
  "This row was created but could not be recorded in import history and could not be safely removed. It is not part of this import's history — review it before treating the import as complete.";

export function untrackedCreatedIds(requestedIds: string[], stampedIds: string[]): string[] {
  const stamped = new Set(stampedIds);
  return requestedIds.filter((id) => !stamped.has(id));
}

export function associationFailureError(rowNumber: number, undone: boolean): ImportRowError {
  return {
    row: rowNumber,
    kind: "error",
    message: undone ? IMPORT_BATCH_ASSOCIATION_FAILED : IMPORT_BATCH_ASSOCIATION_UNTRACKED,
  };
}

export type CreateImportBatchResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export type HistoricalDuplicateDecision =
  | { action: "create" }
  | { action: "skip"; error: ImportRowError }
  | { action: "fail"; error: ImportRowError };

export async function decideHistoricalImportDuplicate(
  rowNumber: number,
  find: () => Promise<{ id: string } | null>,
  duplicateSkipMessage: string,
): Promise<HistoricalDuplicateDecision> {
  try {
    const duplicate = await find();
    if (duplicate) {
      return {
        action: "skip",
        error: { row: rowNumber, message: duplicateSkipMessage, kind: "skipped" },
      };
    }
    return { action: "create" };
  } catch {
    return {
      action: "fail",
      error: { row: rowNumber, message: IMPORT_DUPLICATE_CHECK_FAILED, kind: "error" },
    };
  }
}

export function haltUntrackedHistoricalImport(
  venueId: string | null | undefined,
  batch: CreateImportBatchResult | null,
): { ok: true; batchId: string } | { ok: false; result: ImportResult } {
  if (!venueId) {
    return {
      ok: false,
      result: {
        imported: 0,
        errors: [{ row: 0, message: "No venue found.", kind: "error" }],
        batchId: null,
      },
    };
  }
  if (!batch || !batch.ok) {
    return {
      ok: false,
      result: {
        imported: 0,
        errors: [{ row: 0, message: IMPORT_BATCH_REQUIRED, kind: "error" }],
        batchId: null,
      },
    };
  }
  return { ok: true, batchId: batch.id };
}
