import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

const ONBOARDING_HEADING_FILES = [
  "components/setup-hub/phase-a/welcome-panel.tsx",
  "components/setup-hub/phase-a/setup-hub-phase-a-overview.tsx",
  "components/setup-hub/phase-a/milestone-detail-shell.tsx",
  "components/setup-hub/phase-a/milestone-card.tsx",
  "components/setup-hub/phase-b1/guided-task-card.tsx",
  "components/setup-hub/phase-b1/hosted-event-types-form.tsx",
  "app/(app)/setup-hub/make-htc-yours/event-experiences/page.tsx",
  "app/(app)/setup-hub/make-htc-yours/event-experiences/[eventType]/page.tsx",
  "app/(app)/settings/business/page.tsx",
];

describe("Easy Onboarding typography matches the HTC application", () => {
  it("uses font-heading and font-medium instead of heavy font-serif headings", () => {
    for (const path of ONBOARDING_HEADING_FILES) {
      const src = read(path);
      assert.doesNotMatch(src, /font-serif/, `${path} still uses font-serif`);
      if (path.endsWith("welcome-panel.tsx") || path.endsWith("milestone-detail-shell.tsx")) {
        assert.match(src, /font-heading text-3xl font-medium tracking-tight text-heading/);
      }
    }
    const appHeader = read("components/shell/module-placeholder.tsx");
    assert.match(appHeader, /font-heading text-3xl font-medium tracking-tight text-heading/);
    const greeting = read("components/dashboard/greeting.tsx");
    assert.match(greeting, /font-heading text-3xl font-medium tracking-tight text-heading/);
  });

  it("does not bump welcome or journey titles past application page size", () => {
    const welcome = read("components/setup-hub/phase-a/welcome-panel.tsx");
    const overview = read("components/setup-hub/phase-a/setup-hub-phase-a-overview.tsx");
    assert.doesNotMatch(welcome, /sm:text-4xl/);
    assert.doesNotMatch(overview, /sm:text-3xl/);
    assert.match(overview, /font-heading text-2xl font-medium tracking-tight text-heading/);
  });
});

describe("Easy Onboarding back-navigation hierarchy", () => {
  it("keeps milestone pages returning to the Setup Hub", () => {
    const shell = read("components/setup-hub/phase-a/milestone-detail-shell.tsx");
    assert.match(shell, /backHref = "\/setup-hub"/);
    assert.match(shell, /backLabel = "Back to your setup"/);
    assert.match(shell, /phase-a-back-to-setup/);
  });

  it("returns nested Make HTC yours pages to their immediate parent", () => {
    const booking = read("app/(app)/setup-hub/make-htc-yours/booking-process/page.tsx");
    const experiences = read("app/(app)/setup-hub/make-htc-yours/event-experiences/page.tsx");
    const wedding = read("app/(app)/setup-hub/make-htc-yours/event-experiences/[eventType]/page.tsx");
    const communications = read("app/(app)/setup-hub/make-htc-yours/communications/page.tsx");
    assert.match(booking, /backLabel="Back to Make HTC yours"/);
    assert.match(experiences, /backLabel="Back to Make HTC yours"/);
    assert.match(communications, /backLabel="Back to Make HTC yours"/);
    assert.match(wedding, /backLabel="Back to Your event experiences"/);
    assert.doesNotMatch(booking, /GuidedBackToOverviewLink/);
    assert.doesNotMatch(experiences, /GuidedBackToOverviewLink/);
    assert.doesNotMatch(communications, /GuidedBackToOverviewLink/);
  });

  it("sends Protect your calendar availability editors back to Milestone 1", () => {
    const src = read("app/(app)/setup-hub/protect-calendar/page.tsx");
    assert.match(src, /SETUP_HUB_MILESTONE_RETURN\.protectCalendar/);
    assert.match(src, /withSetupHubReturn/);
    assert.match(src, /focus=spaces/);
    assert.match(src, /focus=rules/);
  });

  it("sends branding, packages, communications, and migration editors back to their onboarding parents", () => {
    const brand = read("app/(app)/settings/business/page.tsx");
    const packages = read("app/(app)/packages/page.tsx");
    const communications = read("app/(app)/settings/communications/page.tsx");
    const migration = read("app/(app)/settings/migration/page.tsx");
    const bring = read("app/(app)/setup-hub/bring-business/page.tsx");
    assert.match(brand, /Back to Make HTC yours/);
    assert.match(brand, /phase-a-back-to-milestone-02/);
    assert.match(packages, /SetupHubReturnLink/);
    assert.match(packages, /Back to your booking process/);
    assert.match(communications, /Back to your communications/);
    assert.match(migration, /Back to Bring your business over/);
    assert.match(bring, /SETUP_HUB_MILESTONE_RETURN\.bringBusiness/);
    assert.match(bring, /phase-a-open-migration/);
  });

  it("does not replace ordinary navigation when from=setup-hub is absent", () => {
    const returnLink = read("components/setup-hub/phase-b1/setup-hub-return-link.tsx");
    const collection = read("components/library/collection-back-link.tsx");
    assert.match(returnLink, /params.get\("from"\) !== "setup-hub"/);
    assert.match(collection, /fromSetupHub && isLibraryEscape\(href\)/);
    assert.match(collection, /href === "\/library"/);
  });
});
