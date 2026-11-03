/**
 * Color Distribution Phase 10 — Reporting + Documents hybrid Option C+B.
 * Structural / token seams only; no metric or document-action assertions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Color Distribution Phase 10 — Reporting + Documents hospitality", () => {
  const css = read("app/globals.css");
  const shell = read("components/reporting/reports-layout-shell.tsx");
  const dateRange = read("components/reporting/date-range-control.tsx");
  const docs = read("components/document-workspace/document-workspace.tsx");
  const libraryDocs = read("app/(app)/library/documents/page.tsx");
  const contracts = read("app/(app)/contracts/page.tsx");
  const payments = read("app/(app)/payments/page.tsx");
  const savedPage = read("app/(app)/reporting/saved/page.tsx");

  it("defines accented intro, linen filter, and section-label utilities", () => {
    assert.match(css, /\.htc-staff \.htc-hospitality-intro\.htc-hospitality-intro-accent/);
    assert.match(css, /\.htc-staff \.htc-hospitality-heading\.htc-hospitality-intro-accent/);
    assert.match(
      css,
      /\.htc-hospitality-intro-accent[\s\S]*?border-left:\s*5px solid var\(--htc-botanical\)/,
    );
    assert.match(
      css,
      /\.htc-staff \.htc-hospitality-filter \{[\s\S]*?background:\s*var\(--htc-linen\)/,
    );
    assert.match(
      css,
      /\.htc-staff \.htc-hospitality-section-label \{[\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/,
    );
    assert.match(css, /--htc-linen:\s*#f3f0e9/i);
    assert.match(css, /--htc-eucalyptus-surface:\s*#dce8e0/i);
    assert.match(css, /--htc-botanical:\s*#446b56/i);
  });

  it("Reports shell shares accented eucalyptus intro without changing copy", () => {
    assert.match(shell, /htc-hospitality-intro htc-hospitality-intro-accent/);
    assert.match(shell, /data-htc-phase10="reporting"/);
    assert.match(shell, /How your business is doing — bookings, revenue, sales, and events\./);
    assert.match(shell, /<ReportTabs/);
    assert.doesNotMatch(shell, /htc-hospitality-filter/);
  });

  it("DateRangeControl uses linen filter toolbar; Saved Reports page does not mount it", () => {
    assert.match(dateRange, /htc-hospitality-filter/);
    assert.match(dateRange, /data-htc-phase10="reporting-date-toolbar"/);
    assert.match(dateRange, /Showing \{label\}/);
    assert.match(dateRange, /SaveReportButton/);
    assert.doesNotMatch(savedPage, /DateRangeControl/);
  });

  it("Documents workspace uses Option C intro, eucalyptus section bands, white toolbar, no linen list wrapper", () => {
    assert.match(docs, /data-htc-phase10="documents-workspace"/);
    assert.match(docs, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(docs, /htc-hospitality-section-label/);
    assert.match(docs, /htc-hospitality-toolbar flex flex-wrap/);
    assert.doesNotMatch(docs, /htc-hospitality-filter/);
    assert.doesNotMatch(docs, /p10-docs-list|linen list/i);
    assert.match(docs, /Categories/);
    assert.match(docs, /All Documents/);
    assert.match(docs, /Search documents/);
  });

  it("Library Documents gets accented intro only — no category bands or linen toolbar", () => {
    assert.match(libraryDocs, /data-htc-phase10="library-documents"/);
    assert.match(libraryDocs, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(libraryDocs, /LibraryDocumentsManager/);
    assert.doesNotMatch(libraryDocs, /htc-hospitality-section-label|htc-hospitality-filter|htc-hospitality-toolbar/);
    assert.match(
      libraryDocs,
      /Files you reuse across bookings — available to your whole venue, not tied to one lead or event\./,
    );
  });

  it("Phase 8 Contracts/Payments keep plain hospitality intro (no accent modifier)", () => {
    assert.match(contracts, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(payments, /htc-hospitality-heading htc-hospitality-intro-accent/);
  });
});
