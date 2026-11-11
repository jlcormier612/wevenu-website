/**
 * Regression: migration onboarding guidance stays discoverable and plain-language.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const panel = readFileSync(resolve("components/settings/migration-guidance-panel.tsx"), "utf8");
const importPage = readFileSync(resolve("app/(app)/settings/import/page.tsx"), "utf8");
const migrationPage = readFileSync(resolve("app/(app)/settings/migration/page.tsx"), "utf8");
const migrationCenter = readFileSync(resolve("components/settings/migration-center.tsx"), "utf8");
const helpArticle = readFileSync(resolve("lib/help-guides/final-articles.ts"), "utf8");
const teamPage = readFileSync(resolve("app/(app)/settings/team/page.tsx"), "utf8");
const sourceSelection = readFileSync(resolve("lib/migration/source-selection.ts"), "utf8");

describe("migration guidance onboarding", () => {
  it("Migration Center page mounts the guidance panel before the engine UI", () => {
    assert.match(migrationPage, /MigrationGuidancePanel/);
    assert.match(panel, /How to bring your existing business over/);
    assert.match(panel, /Suggested order|Prepare|Calendar|Agreements & money/);
    assert.match(panel, /\/settings\/import/);
    assert.match(panel, /\/settings\/availability/);
  });

  it("does not leave Active Commitment unexplained on venue-facing pages", () => {
    assert.doesNotMatch(importPage, /Active Commitment/);
    assert.doesNotMatch(migrationPage, /active commitments \(Event Order/i);
    assert.doesNotMatch(panel, /Active [Cc]ommitment/);
    assert.match(migrationCenter, /Booked-event finances \(invoice, payments, signed agreement\)/);
    assert.match(importPage, /booked-event finances|invoices, payment schedules, and signed agreements/i);
  });

  it("canonical help article is a practical migration checklist", () => {
    const article = helpArticle.slice(
      helpArticle.indexOf('slug: "what-should-i-set-up-before-i-start"'),
      helpArticle.indexOf('slug: "where-do-my-venue-colors-actually-show-up"'),
    );
    assert.match(article, /How to Bring Your Business Over/);
    assert.match(article, /Suggested order/);
    assert.match(article, /Booked-event finances/);
    assert.doesNotMatch(article, /\(Active commitment\)/);
    assert.match(article, /no one-click undo/i);
    assert.match(article, /Import Data/);
    assert.match(article, /Migration Center/);
  });

  it("Team & Data entry points describe both paths honestly", () => {
    assert.match(teamPage, /Open Import Data/);
    assert.match(teamPage, /Open Migration Center/);
    assert.match(teamPage, /events, tours, date holds/);
    assert.match(teamPage, /How to bring your business over/);
  });

  it("Migration Center intro mentions calendar and booked-event finances", () => {
    assert.match(sourceSelection, /booked-event invoices and signed agreements/);
    assert.match(sourceSelection, /Booked-event finances/);
  });

  it("Internal active_commitment entity key remains for the engine", () => {
    assert.match(migrationCenter, /"active_commitment"/);
    assert.match(migrationCenter, /COMMITTABLE_ENTITIES/);
  });
});
