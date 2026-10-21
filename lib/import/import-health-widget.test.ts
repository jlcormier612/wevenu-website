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
    assert.match(widget, /records currently in your venue/);
    assert.match(widget, /manually or imported/);
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

  it("keeps Migration Center direction on the page, not inside live-count bullets", () => {
    assert.doesNotMatch(widget, /Coming soon/);
    assert.doesNotMatch(widget, /Not on Import Data/);
    assert.doesNotMatch(widget, /Standalone payment CSV/);
    assert.doesNotMatch(widget, /USE_MIGRATION_CENTER/);
    assert.match(importPage, /Bringing over existing bookings or financial records/);
    assert.match(importPage, /\/settings\/migration/);
    assert.match(importPage, /Active Commitment/);
  });
});

describe("Import Data and Migration Center path copy", () => {
  const wizard = readFileSync(resolve("components/settings/import-wizard.tsx"), "utf8");
  const migrationPage = readFileSync(resolve("app/(app)/settings/migration/page.tsx"), "utf8");

  it("Import Data page lists supported entities and points calendar/financial work to MC once", () => {
    assert.match(importPage, /clients, leads, vendors, inventory templates, or package/);
    assert.match(importPage, /CSV, Excel, Word, PDF, or a pasted list/);
    assert.match(importPage, /Bringing over existing bookings or financial records/);
    assert.match(importPage, /Migration Center/);
    assert.doesNotMatch(importPage, /Those records are not imported on this page/);
    assert.doesNotMatch(importPage, /Standalone payment CSV/);
  });

  it("entity picker no longer repeats Migration Center footer copy", () => {
    assert.doesNotMatch(wizard, /Need Events, tours, holds/);
    assert.doesNotMatch(wizard, /Coming soon/);
  });

  it("Migration Center page describes cutover scope and CSV vs Import Data file types", () => {
    assert.match(migrationPage, /active commitments/);
    assert.match(migrationPage, /Import Data/);
    assert.match(migrationPage, /CSV here/);
  });
});
