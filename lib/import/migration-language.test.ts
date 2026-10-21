/**
 * Regression: Import Data / Migration Center customer-facing directions stay honest.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const widget = readFileSync(resolve("components/settings/import-health-widget.tsx"), "utf8");
const importPage = readFileSync(resolve("app/(app)/settings/import/page.tsx"), "utf8");
const wizard = readFileSync(resolve("components/settings/import-wizard.tsx"), "utf8");
const migrationPage = readFileSync(resolve("app/(app)/settings/migration/page.tsx"), "utf8");
const migrationCenter = readFileSync(resolve("components/settings/migration-center.tsx"), "utf8");
const helpArticle = readFileSync(resolve("lib/help-guides/final-articles.ts"), "utf8");

describe("migration language honesty", () => {
  it("does not advertise Events/Contracts/Invoices as Coming soon on Import Data", () => {
    assert.doesNotMatch(widget, /Coming soon/);
    assert.doesNotMatch(importPage, /Coming soon/i);
    assert.doesNotMatch(wizard, /Coming soon/i);
  });

  it("Import Data vocabulary stays the five supported entities", () => {
    assert.match(
      importPage,
      /VALID_TYPES = new Set<EntityType>\(\["couples", "leads", "vendors", "inventory", "packages"\]\)/,
    );
    assert.doesNotMatch(importPage, /VALID_TYPES[\s\S]{0,120}"event"/);
  });

  it("Migration Center still exposes Events and active commitment (not Coming soon)", () => {
    assert.match(migrationCenter, /COMMITTABLE_ENTITIES/);
    assert.match(migrationCenter, /"event"/);
    assert.match(migrationCenter, /"active_commitment"/);
    assert.match(migrationCenter, /"tour"/);
    assert.match(migrationCenter, /"date_hold"/);
    assert.match(migrationCenter, /"calendar_block"/);
  });

  it("help article linked from Import/Migration explains both paths in plain language", () => {
    assert.match(helpArticle, /slug: "what-should-i-set-up-before-i-start"/);
    const article = helpArticle.slice(
      helpArticle.indexOf('slug: "what-should-i-set-up-before-i-start"'),
      helpArticle.indexOf('slug: "where-do-my-venue-colors-actually-show-up"'),
    );
    assert.match(article, /Import Data/);
    assert.match(article, /Migration Center/);
    assert.match(article, /Booked-event finances/);
    assert.match(article, /Standalone payment/);
    assert.doesNotMatch(article, /coming soon/i);
    assert.doesNotMatch(article, /\(Active commitment\)/);
  });

  it("Import Data page uses one concise Migration Center section without technical CSV caveats", () => {
    assert.match(importPage, /Bringing over existing bookings or financial records/);
    assert.match(importPage, /\/settings\/migration/);
    assert.match(importPage, /\/settings\/availability/);
    assert.doesNotMatch(importPage, /Active Commitment/);
    assert.doesNotMatch(importPage, /Standalone payment CSV/);
    assert.doesNotMatch(importPage, /Those records are not imported on this page/);
    assert.doesNotMatch(widget, /Standalone payment CSV/);
    assert.doesNotMatch(widget, /Not on Import Data/);
  });

  it("both settings pages keep the shared setup help link", () => {
    assert.match(importPage, /\/help\/what-should-i-set-up-before-i-start/);
    assert.match(migrationPage, /\/help\/what-should-i-set-up-before-i-start/);
    assert.match(importPage, /How to bring your business over/);
    assert.match(migrationPage, /How to bring your business over/);
  });
});
