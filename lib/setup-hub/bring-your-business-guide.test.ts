import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isPreGraduationAllowedPath } from "./pre-graduation-paths";
import {
  BRING_YOUR_BUSINESS_GUIDE_HREF,
  BRING_YOUR_BUSINESS_GUIDE_STEPS,
  BRING_YOUR_BUSINESS_WILL_NOT,
  BRING_YOUR_BUSINESS_WILL_NOT_DO_AUTOMATICALLY,
  evaluateGuideProgress,
  hasMeaningfulExistingBusiness,
  spreadsheetImportedCount,
} from "./bring-your-business-guide";

describe("Bring Your Business guided sequence", () => {
  it("defines five guidance steps in the approved order", () => {
    assert.deepEqual(
      BRING_YOUR_BUSINESS_GUIDE_STEPS.map((s) => s.id),
      ["people", "venue-events", "packages-financials", "planning", "review"],
    );
    assert.equal(BRING_YOUR_BUSINESS_GUIDE_STEPS[0].title, "People");
    assert.equal(BRING_YOUR_BUSINESS_GUIDE_STEPS[1].title, "Venue and events");
    assert.equal(BRING_YOUR_BUSINESS_GUIDE_STEPS[2].title, "Packages and financial information");
    assert.equal(BRING_YOUR_BUSINESS_GUIDE_STEPS[3].title, "Planning resources");
    assert.equal(BRING_YOUR_BUSINESS_GUIDE_STEPS[4].title, "Review and get started");
  });

  it("routes every import action to existing Import Data or Migration Center tools", () => {
    const hrefs = BRING_YOUR_BUSINESS_GUIDE_STEPS.flatMap((s) => s.categories.map((c) => c.href));
    for (const href of hrefs) {
      assert.ok(
        href.startsWith("/settings/import")
          || href.startsWith("/settings/migration")
          || href.startsWith("/settings/availability")
          || href.startsWith("/clients")
          || href.startsWith("/calendar")
          || href.startsWith("/settings/leads/setup-profiles"),
        href,
      );
      assert.equal(isPreGraduationAllowedPath(BRING_YOUR_BUSINESS_GUIDE_HREF), true);
    }
    assert.ok(hrefs.some((h) => h.includes("/settings/import?type=couples")));
    assert.ok(hrefs.some((h) => h.includes("/settings/migration")));
    assert.doesNotMatch(hrefs.join("\n"), /honeybook\.com|tripleseat\.com/);
  });

  it("states financial and planning prerequisites in plain language", () => {
    const finances = BRING_YOUR_BUSINESS_GUIDE_STEPS
      .flatMap((s) => s.categories)
      .find((c) => c.id === "finances");
    assert.ok(finances);
    assert.match(finances.dependsOn?.label ?? "", /clients and events to exist first/i);
    assert.match(finances.fileTypes, /PDF|docx/i);
    assert.doesNotMatch(finances.canImport, /automatically create a structured contract/i);

    const documents = BRING_YOUR_BUSINESS_GUIDE_STEPS
      .flatMap((s) => s.categories)
      .find((c) => c.id === "documents");
    assert.ok(documents);
    assert.match(documents.canImport, /does not automatically create a structured contract/i);
  });

  it("does not promise automatic outreach, payments, or a full undo", () => {
    assert.ok(BRING_YOUR_BUSINESS_WILL_NOT.some((line) => /Invite clients/i.test(line)));
    assert.ok(BRING_YOUR_BUSINESS_WILL_NOT.some((line) => /email or SMS/i.test(line)));
    assert.match(BRING_YOUR_BUSINESS_WILL_NOT_DO_AUTOMATICALLY, /not a full undo/i);
  });
});

describe("evaluateGuideProgress", () => {
  const empty = {
    batches: [] as const,
    hasMigrationImport: false,
    uploadedMaterialsCount: 0,
    path: null,
  };

  it("stays not started until durable imports exist", () => {
    const progress = evaluateGuideProgress(empty);
    assert.equal(progress.people, "not_started");
    assert.equal(progress["venue-events"], "not_started");
    assert.equal(progress.review, "not_started");
  });

  it("marks people brought over from import_batches, not from opening a page", () => {
    const progress = evaluateGuideProgress({
      ...empty,
      batches: [{
        entityType: "couples",
        importedCount: 12,
        errorCount: 0,
        skippedCount: 1,
        rolledBackAt: null,
        migrationSessionId: null,
      }],
    });
    assert.equal(progress.people, "imported");
    assert.equal(progress["venue-events"], "not_started");
  });

  it("flags needs attention when a batch has errors", () => {
    const progress = evaluateGuideProgress({
      ...empty,
      batches: [{
        entityType: "couples",
        importedCount: 2,
        errorCount: 4,
        skippedCount: 0,
        rolledBackAt: null,
        migrationSessionId: null,
      }],
    });
    assert.equal(progress.people, "needs_attention");
  });

  it("ignores rolled-back batches", () => {
    const progress = evaluateGuideProgress({
      ...empty,
      batches: [{
        entityType: "couples",
        importedCount: 8,
        errorCount: 0,
        skippedCount: 0,
        rolledBackAt: "2026-11-01T00:00:00Z",
        migrationSessionId: null,
      }],
    });
    assert.equal(progress.people, "not_started");
  });

  it("uses Migration Center evidence for events and does not invent a percentage", () => {
    const progress = evaluateGuideProgress({
      ...empty,
      hasMigrationImport: true,
    });
    assert.equal(progress["venue-events"], "imported");
    assert.equal(progress.review, "not_started");
  });

  it("treats skip / add-individually as optional, not complete", () => {
    const skipped = evaluateGuideProgress({ ...empty, path: "skipped" });
    assert.equal(skipped.people, "optional");
    assert.equal(skipped.review, "not_started");
    const individual = evaluateGuideProgress({ ...empty, path: "individual" });
    assert.equal(individual.people, "optional");
  });
});

describe("hasMeaningfulExistingBusiness", () => {
  it("does not treat an empty venue as already migrated", () => {
    assert.equal(
      hasMeaningfulExistingBusiness({ contactCount: 0, hasMigrationImport: false, spreadsheetImportedCount: 0 }),
      false,
    );
  });

  it("recognizes imported or existing contacts without requiring Chapter 4", () => {
    assert.equal(
      hasMeaningfulExistingBusiness({ contactCount: 50, hasMigrationImport: false, spreadsheetImportedCount: 0 }),
      true,
    );
    assert.equal(
      hasMeaningfulExistingBusiness({ contactCount: 0, hasMigrationImport: true, spreadsheetImportedCount: 0 }),
      true,
    );
  });

  it("counts durable spreadsheet imports", () => {
    assert.equal(
      spreadsheetImportedCount([{
        entityType: "couples",
        importedCount: 50,
        errorCount: 0,
        skippedCount: 0,
        rolledBackAt: null,
        migrationSessionId: null,
      }]),
      50,
    );
  });
});

describe("Setup Hub starting choice + guide page", () => {
  it("places a starting choice on the Hub without adding a fifth chapter", () => {
    const overview = readFileSync(join(process.cwd(), "components/setup-hub/setup-hub-overview.tsx"), "utf8");
    const choice = readFileSync(join(process.cwd(), "components/setup-hub/setup-hub-starting-choice.tsx"), "utf8");
    const chapters = readFileSync(join(process.cwd(), "lib/setup-hub/chapters.ts"), "utf8");
    assert.match(overview, /SetupHubStartingChoice/);
    assert.match(choice, /Starting fresh\?/);
    assert.match(choice, /Bringing an existing business\?/);
    assert.match(choice, /setup-hub\/bring-your-business/);
    assert.match(chapters, /id: "make-it-yours"/);
    assert.doesNotMatch(chapters, /id: "bring-your-business-chapter"/);
  });

  it("does not lock the owner to one path", () => {
    const choice = readFileSync(join(process.cwd(), "components/setup-hub/setup-hub-starting-choice.tsx"), "utf8");
    assert.doesNotMatch(choice, /setBringYourBusinessPathAction/);
    assert.match(choice, /You can switch anytime/);
  });

  it("keeps White Glove as personal help, not a requirement to import", () => {
    const choice = readFileSync(join(process.cwd(), "components/setup-hub/setup-hub-starting-choice.tsx"), "utf8");
    assert.match(choice, /isWhiteGlove/);
    assert.match(choice, /not required to bring clients and events over/);
    const layout = readFileSync(join(process.cwd(), "app/(app)/layout.tsx"), "utf8");
    assert.match(layout, /white_glove_status === "waiting"/);
    assert.match(layout, /onboarding\/white-glove\//);
  });

  it("surfaces imported contacts on Clients → Contacts, not as booked events", () => {
    const list = readFileSync(join(process.cwd(), "components/clients/client-list.tsx"), "utf8");
    assert.match(list, /imported-contacts-hint/);
    assert.match(list, /setFilter\("contacts"\)/);
    assert.match(list, /They are not booked events/);
  });
});
