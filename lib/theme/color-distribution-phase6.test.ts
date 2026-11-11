/**
 * Color Distribution Phase 6 — Migration guidance hierarchy + Import cutover tip.
 * Message Templates HowItWorks and EO Example remain excluded.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Color Distribution Phase 6 — Migration guidance + Import cutover", () => {
  const migrationPanel = read("components/settings/migration-guidance-panel.tsx");
  const migrationPage = read("app/(app)/settings/migration/page.tsx");
  const importPage = read("app/(app)/settings/import/page.tsx");
  const templates = read("app/(app)/communication/templates/page.tsx");
  const eo = read("app/(app)/library/event-order-templates/page.tsx");
  const banner = read("components/payments/schedule-review-banner.tsx");
  const settingsIndex = read("app/(app)/settings/page.tsx");
  const css = read("app/globals.css");

  it("MigrationGuidancePanel uses single shell with calm intro and white instructional body", () => {
    assert.match(migrationPage, /MigrationGuidancePanel/);
    assert.match(migrationPanel, /htc-migration-guidance/);
    assert.match(migrationPanel, /htc-migration-guidance-intro/);
    assert.match(migrationPanel, /htc-migration-guidance-body/);
    assert.match(migrationPanel, /data-testid="migration-guidance-panel"/);
    assert.equal((migrationPanel.match(/htc-migration-guidance[^-]/g) ?? []).length, 1);
    assert.doesNotMatch(migrationPanel, /bg-card|border-border bg-/);

    const intro = migrationPanel.slice(
      migrationPanel.indexOf("htc-migration-guidance-intro"),
      migrationPanel.indexOf("htc-migration-guidance-body"),
    );
    assert.match(intro, /How to bring your existing business over/);
    assert.match(intro, /Import Data/);
    assert.match(intro, /Migration Center/);
    // Intro is heading + explanatory copy only — step titles live in the steps array / body list.
    assert.doesNotMatch(intro, /title:\s*"Prepare"|title:\s*"Review & verify"/);

    const body = migrationPanel.slice(migrationPanel.indexOf("htc-migration-guidance-body"));
    assert.match(body, /\{steps\.map/);
    assert.match(body, /Full migration checklist/);
    assert.match(body, /\{step\.title\}/);
    assert.match(body, /\{step\.body\}/);
  });

  it("preserves all five migration steps, order, links, and copy themes", () => {
    const titles = [
      'title: "Prepare"',
      'title: "People & templates"',
      'title: "Calendar"',
      'title: "Agreements & money on booked events"',
      'title: "Review & verify"',
    ];
    let last = -1;
    for (const title of titles) {
      const idx = migrationPanel.indexOf(title);
      assert.ok(idx > last, `expected ${title} after prior step`);
      last = idx;
    }
    assert.match(migrationPanel, /\/settings\/availability/);
    assert.match(migrationPanel, /\/settings\/import/);
    assert.match(migrationPanel, /\/help\/what-should-i-set-up-before-i-start/);
    assert.match(migrationPanel, /n: "1"/);
    assert.match(migrationPanel, /n: "5"/);
  });

  it("Import cutover pointer uses compact calm class without restyling the wizard", () => {
    assert.match(importPage, /htc-import-cutover-pointer/);
    assert.match(importPage, /data-testid="import-cutover-pointer"/);
    assert.match(importPage, /Bringing over existing bookings or financial records\?/);
    assert.match(importPage, /\/settings\/migration/);
    assert.match(importPage, /\/settings\/availability/);
    assert.match(importPage, /ImportWizard/);
    assert.match(importPage, /ImportHealthWidget/);
    // Calm class appears once; wizard mount is after the pointer.
    assert.equal((importPage.match(/htc-import-cutover-pointer/g) ?? []).length, 1);
    const pointerIdx = importPage.indexOf("htc-import-cutover-pointer");
    const wizardIdx = importPage.indexOf("<ImportWizard");
    assert.ok(pointerIdx > 0 && wizardIdx > pointerIdx);
  });

  it("Phase 6 CSS: migration intro/body hierarchy + import cutover full calm", () => {
    const migStart = css.indexOf(".htc-staff .htc-migration-guidance {");
    assert.ok(migStart > 0);
    const migBlock = css.slice(migStart, css.indexOf(".htc-staff .htc-import-cutover-pointer {", migStart));
    assert.match(migBlock, /background-color:\s*#ffffff/);
    assert.match(migBlock, /border-left:\s*3px solid var\(--htc-calm-blue-deep\)/);
    assert.match(migBlock, /border-color:\s*var\(--htc-border-calm\)/);
    assert.match(
      migBlock,
      /\.htc-migration-guidance-intro[\s\S]*background-color:\s*var\(--htc-calm-blue\)/,
    );
    assert.match(
      migBlock,
      /\.htc-migration-guidance-body[\s\S]*background-color:\s*#ffffff/,
    );
    assert.doesNotMatch(migBlock, /#eaf1f7|#d5e1eb|#dfe9f1/i);

    const cutStart = css.indexOf(".htc-staff .htc-import-cutover-pointer {");
    assert.ok(cutStart > 0);
    const cutBlock = css.slice(cutStart, css.indexOf(".htc-staff .htc-catalog-section", cutStart));
    assert.match(cutBlock, /background-color:\s*var\(--htc-calm-blue\)/);
    assert.match(cutBlock, /border-left:\s*3px solid var\(--htc-calm-blue-deep\)/);
    assert.match(cutBlock, /border-color:\s*var\(--htc-border-calm\)/);
    assert.doesNotMatch(cutBlock, /#eaf1f7|#d5e1eb|#dfe9f1/i);
  });

  it("does not expand Phase 6 into excluded surfaces", () => {
    assert.match(templates, /LibraryHowItWorks tone="calm"/);
    assert.match(eo, /data-testid="eo-templates-landing-example"/);
    assert.match(eo, /LibraryDependencyNote[\s\S]*tone="calm"/);
    assert.match(
      banner,
      /className="rounded-sm border border-border bg-muted\/30 px-4 py-3 space-y-3"/,
    );
    assert.match(settingsIndex, /htc-settings-directory-card|bg-card p-5/);
    assert.doesNotMatch(settingsIndex, /htc-migration-guidance|htc-import-cutover-pointer/);
  });

  it("preserves Phase 1–5 calm CSS anchors", () => {
    assert.match(css, /\.htc-staff \.htc-library-guidance-calm/);
    assert.match(css, /\.htc-staff \.htc-inbox-no-selection/);
    assert.match(css, /\.htc-staff \.htc-communication-health-guidance/);
    assert.match(css, /section\.htc-automations-help/);
    assert.match(css, /\.htc-staff \.htc-setup-hub-welcome/);
    assert.match(css, /\.htc-staff \.htc-contract-agreement-guidance/);
    assert.match(css, /\.htc-staff \.htc-task-center-plate-clear/);
    assert.match(css, /\.htc-staff \.htc-availability-settings-guidance/);
  });
});
