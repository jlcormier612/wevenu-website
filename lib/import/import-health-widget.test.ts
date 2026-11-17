import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const widget = readFileSync(resolve("components/settings/import-health-widget.tsx"), "utf8");
const importPage = readFileSync(resolve("app/(app)/settings/import/page.tsx"), "utf8");
const bybPage = readFileSync(resolve("app/(app)/setup-hub/bring-your-business/page.tsx"), "utf8");

describe("Import page live totals vs import history", () => {
  it("does not title live CRM counts as Import Progress", () => {
    assert.doesNotMatch(widget, /Import Progress/);
    assert.match(widget, /In Hello to Cheers now/);
    assert.match(widget, /records currently in your venue/);
    assert.match(widget, /manually or imported/);
    assert.match(widget, /byb-live-totals/);
    assert.match(widget, /data-count=\{s\.count\}/);
  });

  it("keeps live totals on the existing CRM queries", () => {
    assert.match(widget, /getClients\(\)/);
    assert.match(widget, /getLeads\(\)/);
    assert.match(widget, /getVendors\(\)/);
  });

  it("shows import history from import_batches, separately from live totals", () => {
    assert.match(widget, /getImportBatches\(\)/);
    assert.match(widget, /Import history/);
    assert.doesNotMatch(widget, /CSV import history/);
    assert.doesNotMatch(widget, /migration_sessions/);
  });

  it("is mounted on Bring Your Business relationship stages", () => {
    assert.match(bybPage, /ImportHealthWidget/);
    assert.match(importPage, /legacyImportRedirectHref/);
    assert.ok(bybPage.indexOf("<ImportWizard") < bybPage.indexOf("<ImportHealthWidget"));
  });

  it("does not bury Migration Center jargon in live-count bullets", () => {
    assert.doesNotMatch(widget, /Coming soon/);
    assert.doesNotMatch(widget, /Not on Import Data/);
    assert.doesNotMatch(widget, /Standalone payment CSV/);
    assert.doesNotMatch(widget, /USE_MIGRATION_CENTER/);
  });
});

describe("Import Data and Migration Center path copy", () => {
  const wizard = readFileSync(resolve("components/settings/import-wizard.tsx"), "utf8");
  const migrationPage = readFileSync(resolve("app/(app)/settings/migration/page.tsx"), "utf8");

  it("legacy Import Data and Migration Center pages redirect into the journey", () => {
    assert.match(importPage, /legacyImportRedirectHref/);
    assert.match(migrationPage, /legacyMigrationRedirectHref/);
    assert.match(bybPage, /ImportWizard/);
    assert.match(bybPage, /MigrationCenter/);
  });

  it("entity picker no longer repeats Migration Center footer copy", () => {
    assert.doesNotMatch(wizard, /Need Events, tours, holds/);
    assert.doesNotMatch(wizard, /Coming soon/);
  });
});
