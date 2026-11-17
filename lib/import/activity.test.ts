import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasDatedMigrationImport,
  hasSuccessfulImportActivity,
  importActivityTotals,
  phaseAImportFlags,
} from "@/lib/import/activity";

const wizardPeople = {
  importedCount: 3,
  skippedCount: 2,
  errorCount: 0,
  rolledBackAt: null,
  migrationSessionId: null,
};

const migrationDates = {
  importedCount: 4,
  skippedCount: 0,
  errorCount: 1,
  rolledBackAt: null,
  migrationSessionId: "session-1",
};

describe("import activity from either engine", () => {
  it("counts Import Wizard batches without a migration session as imported activity", () => {
    assert.equal(hasSuccessfulImportActivity([wizardPeople]), true);
    assert.equal(hasDatedMigrationImport([wizardPeople]), false);
  });

  it("counts Migration Center session batches as both imported activity and dated migration", () => {
    assert.equal(hasSuccessfulImportActivity([migrationDates]), true);
    assert.equal(hasDatedMigrationImport([migrationDates]), true);
  });

  it("does not treat rolled-back batches or empty history as imported activity", () => {
    assert.equal(
      hasSuccessfulImportActivity([{ ...wizardPeople, rolledBackAt: "2026-11-16T00:00:00Z" }]),
      false,
    );
    assert.equal(hasSuccessfulImportActivity([]), false);
    assert.equal(
      hasSuccessfulImportActivity([{ ...wizardPeople, importedCount: 0, skippedCount: 4 }]),
      false,
    );
  });

  it("does not infer imports from live record counts — only batches", () => {
    const flags = phaseAImportFlags([]);
    assert.equal(flags.hasImportedActivity, false);
    assert.equal(flags.hasMigrationImport, false);
  });

  it("keeps imported / skipped / needs-attention totals separate from live CRM counts", () => {
    assert.deepEqual(importActivityTotals([wizardPeople, migrationDates]), {
      imported: 7,
      skipped: 2,
      needsAttention: 1,
    });
  });
});
