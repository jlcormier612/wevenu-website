import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("Saved Reports navigation", () => {
  it("shows a Templates back link on the Reports shell", () => {
    const shell = readFileSync("components/reporting/reports-layout-shell.tsx", "utf8");
    assert.match(shell, /PageHeader[\s\S]*title="Reports"/);
    assert.match(shell, /ReportTabs/);
    assert.match(shell, /CollectionBackLink/);
    assert.match(shell, /label="Templates"/);
    assert.match(shell, /href="\/library"/);
  });

  it("keeps Library Brochures Templates back link (library collection escape)", () => {
    const brochures = readFileSync("app/(app)/library/brochures/page.tsx", "utf8");
    assert.match(
      brochures,
      /CollectionBackLink[\s\S]*href="\/library"[\s\S]*label="Templates"/,
    );
  });

  it("keeps Saved Reports list page content under the shell", () => {
    const page = readFileSync("app/(app)/reporting/saved/page.tsx", "utf8");
    const list = readFileSync("components/reporting/saved-report-list.tsx", "utf8");
    assert.match(page, /PageHeader[\s\S]*title="Saved Reports"/);
    assert.match(page, /SavedReportList/);
    assert.match(page, /htc-surface-guidance/);
    assert.match(page, /About Saved Reports/);
    assert.doesNotMatch(page, /starters point at/);
    assert.doesNotMatch(list, /htc-report-saved-shell/);
    assert.match(list, /data-report-saved-list/);
  });

  it("wires the reporting layout through ReportsLayoutShell", () => {
    const layout = readFileSync("app/(app)/reporting/layout.tsx", "utf8");
    assert.match(layout, /ReportsLayoutShell/);
  });

  it("manage mode keeps Saved Reports escape under the Templates shell link", () => {
    const detail = readFileSync("components/reporting/saved-report-detail.tsx", "utf8");
    assert.match(detail, /backHref="\/reporting\/saved"/);
    assert.match(detail, /backLabel="Saved Reports"/);
  });
});
