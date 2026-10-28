import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("Saved Reports Templates back navigation", () => {
  it("uses CollectionBackLink labeled Templates above the Reports heading on /reporting/saved", () => {
    const brochures = readFileSync("app/(app)/library/brochures/page.tsx", "utf8");
    assert.match(
      brochures,
      /CollectionBackLink[\s\S]*href="\/library"[\s\S]*label="Templates"/,
    );

    const shell = readFileSync("components/reporting/reports-layout-shell.tsx", "utf8");
    assert.match(
      shell,
      /CollectionBackLink[\s\S]*href="\/library"[\s\S]*label="Templates"/,
    );
    assert.match(shell, /pathname === "\/reporting\/saved"/);
    assert.match(shell, /PageHeader[\s\S]*title="Reports"/);
    assert.match(shell, /ReportTabs/);

    const back = shell.indexOf("CollectionBackLink");
    const reportsHeader = shell.indexOf('title="Reports"');
    assert.ok(back >= 0, "CollectionBackLink must exist");
    assert.ok(reportsHeader > back, "Templates back link must render above the Reports PageHeader");
    assert.doesNotMatch(shell, /Back to Templates/);
    assert.doesNotMatch(shell, /← Back to Templates/);
    assert.equal((shell.match(/label="Templates"/g) ?? []).length, 1);
  });

  it("keeps Saved Reports list page content and does not invent a second back link there", () => {
    const page = readFileSync("app/(app)/reporting/saved/page.tsx", "utf8");
    assert.match(page, /PageHeader[\s\S]*title="Saved Reports"/);
    assert.match(page, /SavedReportList/);
    assert.doesNotMatch(page, /CollectionBackLink/);
  });

  it("wires the reporting layout through ReportsLayoutShell", () => {
    const layout = readFileSync("app/(app)/reporting/layout.tsx", "utf8");
    assert.match(layout, /ReportsLayoutShell/);
    assert.doesNotMatch(layout, /CollectionBackLink/);
  });
});
