import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const widget = readFileSync(resolve("components/settings/import-health-widget.tsx"), "utf8");
const importPage = readFileSync(resolve("app/(app)/settings/import/page.tsx"), "utf8");

describe("Import page live totals vs import history", () => {
  it("does not title live CRM counts as Import Progress", () => {
    assert.doesNotMatch(widget, /Import Progress/);
    assert.match(widget, /In Hello to Cheers now/);
    assert.match(widget, /Live counts of records in this venue/);
    assert.match(widget, /not import-history totals/);
  });

  it("keeps live totals on the existing CRM queries", () => {
    assert.match(widget, /getClients\(\)/);
    assert.match(widget, /getLeads\(\)/);
    assert.match(widget, /getVendors\(\)/);
  });

  it("shows CSV import history from import_batches, separately from live totals", () => {
    assert.match(widget, /getImportBatches\(\)/);
    assert.match(widget, /CSV import history/);
    assert.match(widget, /Migration Center has its own session history/);
    assert.doesNotMatch(widget, /migration_sessions/);
  });

  it("is still mounted on the Import Data page", () => {
    assert.match(importPage, /ImportHealthWidget/);
  });
});
