import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("Saved Reports navigation (Phase 11C)", () => {
  it("does not show a Templates breadcrumb on the Reports shell", () => {
    const shell = readFileSync("components/reporting/reports-layout-shell.tsx", "utf8");
    assert.match(shell, /PageHeader[\s\S]*title="Reports"/);
    assert.match(shell, /ReportTabs/);
    assert.doesNotMatch(shell, /CollectionBackLink/);
    assert.doesNotMatch(shell, /label="Templates"/);
    assert.doesNotMatch(shell, /href="\/library"/);
  });

  it("keeps Library Brochures Templates back link (library collection escape)", () => {
    const brochures = readFileSync("app/(app)/library/brochures/page.tsx", "utf8");
    assert.match(
      brochures,
      /CollectionBackLink[\s\S]*href="\/library"[\s\S]*label="Templates"/,
    );
  });

  it("keeps Saved Reports list page content and does not invent a back link there", () => {
    const page = readFileSync("app/(app)/reporting/saved/page.tsx", "utf8");
    assert.match(page, /PageHeader[\s\S]*title="Saved Reports"/);
    assert.match(page, /SavedReportList/);
    assert.doesNotMatch(page, /CollectionBackLink/);
    assert.doesNotMatch(page, /label="Templates"/);
  });

  it("wires the reporting layout through ReportsLayoutShell", () => {
    const layout = readFileSync("app/(app)/reporting/layout.tsx", "utf8");
    assert.match(layout, /ReportsLayoutShell/);
    assert.doesNotMatch(layout, /CollectionBackLink/);
    assert.doesNotMatch(layout, /label="Templates"/);
  });
});
