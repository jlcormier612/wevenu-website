import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  BYB_CONTINUE_WITHOUT_MORE_IMPORTS,
  BYB_ENTRY_CHOICES,
  BYB_ENTRY_HEADLINE,
  BYB_ENTRY_SUPPORTING,
  BYB_REVIEW_ATTENTION,
  BYB_REVIEW_BROUGHT_OVER,
  BYB_REVIEW_SKIPPED,
  BYB_STARTING_FRESH,
  buildBringYourBusinessReview,
  continueBringYourBusinessStage,
  hasBringYourBusinessWork,
  legacyImportRedirectHref,
  legacyMigrationRedirectHref,
} from "./bring-your-business-journey";

describe("Bring Your Business unified journey copy", () => {
  it("uses the exact entry headline, supporting copy, and three choices", () => {
    assert.equal(BYB_ENTRY_HEADLINE, "Bring your business with you.");
    assert.match(BYB_ENTRY_SUPPORTING, /Already managing clients, bookings, and events somewhere else/);
    assert.deepEqual(
      BYB_ENTRY_CHOICES.map((c) => c.title),
      ["Import from another system", "I have spreadsheets or documents"],
    );
    assert.equal(BYB_STARTING_FRESH.title, "I'm starting fresh");
    assert.equal(
      BYB_STARTING_FRESH.description,
      "Skip importing and start setting up your business in Hello to Cheers.",
    );
    assert.equal(BYB_STARTING_FRESH.action, "Continue to Setup");
    assert.equal(BYB_CONTINUE_WITHOUT_MORE_IMPORTS.title, "Continue setup without importing more");
    assert.match(BYB_CONTINUE_WITHOUT_MORE_IMPORTS.description, /bring more information over later/);
    assert.equal(BYB_CONTINUE_WITHOUT_MORE_IMPORTS.action, "Back to Setup");
  });

  it("does not name HoneyBook or Tripleseat on the customer journey", () => {
    const blob = [
      BYB_ENTRY_HEADLINE,
      BYB_ENTRY_SUPPORTING,
      ...BYB_ENTRY_CHOICES.map((c) => `${c.title} ${c.description}`),
      BYB_STARTING_FRESH.title,
      BYB_STARTING_FRESH.description,
    ].join(" ");
    assert.doesNotMatch(blob, /HoneyBook|Tripleseat/i);
    const experience = readFileSync(
      join(process.cwd(), "components/setup-hub/bring-your-business-experience.tsx"),
      "utf8",
    );
    const choices = readFileSync(
      join(process.cwd(), "components/setup-hub/bring-your-business-choices.tsx"),
      "utf8",
    );
    assert.doesNotMatch(experience, /HoneyBook|Tripleseat/i);
    assert.doesNotMatch(choices, /HoneyBook|Tripleseat/i);
  });

  it("redirects legacy Import Data and Migration Center URLs into the journey", () => {
    assert.equal(legacyImportRedirectHref(), "/setup-hub/bring-your-business?stage=prepare");
    assert.equal(
      legacyImportRedirectHref("leads"),
      "/setup-hub/bring-your-business?stage=leads",
    );
    assert.equal(legacyMigrationRedirectHref(), "/setup-hub/bring-your-business?stage=clients");
    assert.equal(
      legacyMigrationRedirectHref("honeybook"),
      "/setup-hub/bring-your-business?stage=clients&source=another_system",
    );
  });

  it("continues to the first unfinished recommended stage without treating skip as incomplete", () => {
    assert.equal(
      continueBringYourBusinessStage({
        leads: "imported",
        clients: "not_started",
        vendors: "not_started",
        "packages-financials": "not_started",
        planning: "not_started",
      }),
      "clients",
    );
    assert.equal(
      continueBringYourBusinessStage({
        leads: "optional",
        clients: "optional",
        vendors: "optional",
        "packages-financials": "optional",
        planning: "optional",
      }),
      "review",
    );
  });

  it("treats durable imports as existing work for Continue", () => {
    assert.equal(hasBringYourBusinessWork({ spreadsheetImportedCount: 0, hasMigrationImport: false }), false);
    assert.equal(hasBringYourBusinessWork({ spreadsheetImportedCount: 2, hasMigrationImport: false }), true);
    assert.equal(hasBringYourBusinessWork({ spreadsheetImportedCount: 0, hasMigrationImport: true }), true);
    assert.equal(
      hasBringYourBusinessWork({
        spreadsheetImportedCount: 0,
        hasMigrationImport: false,
        hasImportedActivity: true,
      }),
      true,
    );
  });
});

describe("Review and finish grouping", () => {
  it("separates brought-over categories from intentionally skipped follow-up work", () => {
    const groups = buildBringYourBusinessReview({
      imported: 10,
      skipped: 9,
      errors: 0,
      leads: "imported",
      clients: "optional",
      vendors: "optional",
      money: "optional",
      planning: "optional",
    });
    assert.equal(BYB_REVIEW_BROUGHT_OVER, "Brought over");
    assert.equal(BYB_REVIEW_SKIPPED, "Skipped for now");
    assert.equal(BYB_REVIEW_ATTENTION, "Needs attention or additional setup");
    assert.ok(groups.broughtOver.some((line) => /10 records imported/.test(line)));
    assert.ok(groups.broughtOver.some((line) => /Leads — brought over/.test(line)));
    assert.ok(groups.skipped.every((line) => /skipped for now/i.test(line)));
    assert.ok(groups.skipped.some((line) => /Clients and their events/.test(line)));
    assert.equal(groups.attention.length, 0);
    assert.ok(!groups.skipped.some((line) => /failure|not ready|needs attention/i.test(line)));
  });

  it("treats unfinished categories as additional setup, not as skipped failures", () => {
    const groups = buildBringYourBusinessReview({
      imported: 2,
      skipped: 0,
      errors: 1,
      leads: "imported",
      clients: "not_started",
      vendors: "not_started",
      money: "needs_attention",
      planning: "not_started",
    });
    assert.ok(groups.attention.some((line) => /1 imported row needs attention/.test(line)));
    assert.ok(groups.attention.some((line) => /Clients and their events — not brought over yet/.test(line)));
    assert.ok(groups.attention.some((line) => /Contracts and money — held or incomplete rows/.test(line)));
    assert.equal(groups.skipped.length, 0);
  });
});
