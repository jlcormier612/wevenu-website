/**
 * Durable import activity from either engine (Import Wizard batches or
 * Migration Center session-linked batches). Live CRM counts are not evidence
 * of an import — only import_batches are.
 */

export type ImportActivityBatch = {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  rolledBackAt: string | null;
  migrationSessionId?: string | null;
};

function isActiveBatch(batch: ImportActivityBatch): boolean {
  return !batch.rolledBackAt;
}

/** At least one successful create through Import Wizard or Migration Center. */
export function hasSuccessfulImportActivity(batches: readonly ImportActivityBatch[]): boolean {
  return batches.some((batch) => isActiveBatch(batch) && batch.importedCount > 0);
}

/** Dated Migration Center run (session-linked). People-list wizard batches are not this. */
export function hasDatedMigrationImport(batches: readonly ImportActivityBatch[]): boolean {
  return batches.some(
    (batch) => isActiveBatch(batch) && batch.importedCount > 0 && Boolean(batch.migrationSessionId),
  );
}

export function importActivityTotals(batches: readonly ImportActivityBatch[]): {
  imported: number;
  skipped: number;
  needsAttention: number;
} {
  return batches.filter(isActiveBatch).reduce(
    (sum, batch) => ({
      imported: sum.imported + batch.importedCount,
      skipped: sum.skipped + batch.skippedCount,
      needsAttention: sum.needsAttention + batch.errorCount,
    }),
    { imported: 0, skipped: 0, needsAttention: 0 },
  );
}

export function phaseAImportFlags(batches: readonly ImportActivityBatch[]): {
  hasImportedActivity: boolean;
  hasMigrationImport: boolean;
} {
  return {
    hasImportedActivity: hasSuccessfulImportActivity(batches),
    hasMigrationImport: hasDatedMigrationImport(batches),
  };
}
