import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { BusinessHourInput } from "@/lib/venue/types";
import {
  isBringYourBusinessComplete,
  isCalendarAvailabilityComplete,
  isClientExperienceComplete,
  isFinancialsComplete,
  isLeadCaptureComplete,
  isYourOfferingsComplete,
  isYourPeopleComplete,
  isYourVenueComplete,
  type YourVenueFacts,
} from "@/lib/setup-hub/stage-completion";

const openHours: BusinessHourInput[] = [
  { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "17:00" },
];

const closedHours: BusinessHourInput[] = [
  { dayOfWeek: 1, isOpen: false, openTime: "", closeTime: "" },
];

function venueFacts(partial: Partial<YourVenueFacts> = {}): YourVenueFacts {
  return {
    name: "Willow",
    email: "hello@willow.test",
    phone: "555-0100",
    businessHours: openHours,
    logoUrl: "https://cdn.example.com/logo.png",
    heroImageUrl: "https://cdn.example.com/hero.jpg",
    primaryColor: "#4A3F35",
    ...partial,
  };
}

describe("Your Venue completion", () => {
  it("completes when every field the card names is present", () => {
    assert.equal(isYourVenueComplete(venueFacts()), true);
  });

  it("stays incomplete when a stated required field is missing", () => {
    assert.equal(isYourVenueComplete(venueFacts({ name: "  " })), false);
    assert.equal(isYourVenueComplete(venueFacts({ email: null })), false);
    assert.equal(isYourVenueComplete(venueFacts({ phone: "" })), false);
    assert.equal(isYourVenueComplete(venueFacts({ logoUrl: null })), false);
    assert.equal(isYourVenueComplete(venueFacts({ heroImageUrl: " " })), false);
    assert.equal(isYourVenueComplete(venueFacts({ primaryColor: null })), false);
    assert.equal(isYourVenueComplete(venueFacts({ businessHours: closedHours })), false);
  });

  it("does not require Venue Guide, legal name, venue type, or capacity", () => {
    const facts = venueFacts();
    assert.equal("story" in facts, false);
    assert.equal("businessName" in facts, false);
    assert.equal("venueType" in facts, false);
    assert.equal("capacity" in facts, false);
    assert.equal("venueGuide" in facts, false);
    assert.equal(isYourVenueComplete(facts), true);
  });

  it("does not use your_venue_reviewed_at for the Your Venue checkmark", () => {
    const overview = readFileSync(resolve("components/setup-hub/setup-hub-overview.tsx"), "utf8");
    assert.match(overview, /isYourVenueComplete\(yourVenueFacts\)/);
    assert.doesNotMatch(overview, /yourVenueReviewedAt/);
    assert.doesNotMatch(overview, /This looks good for now/);
    assert.doesNotMatch(overview, /Venue Guide/);
    const fn = readFileSync(resolve("lib/setup-hub/stage-completion.ts"), "utf8");
    const yourVenueFn = fn.slice(fn.indexOf("export function isYourVenueComplete"), fn.indexOf("export function isCalendarAvailabilityComplete"));
    assert.doesNotMatch(yourVenueFn, /reviewedAt|readyToInviteCouples|story|venueGuide/);
  });
});

describe("Your People completion — explicit Team decision only", () => {
  it("purchaser/admin alone does not complete Your People", () => {
    assert.equal(
      isYourPeopleComplete({ deliberateTeamActionCount: 0, soloConfirmed: false }),
      false,
    );
  });

  it("onboarding owner invitation alone does not complete Your People", () => {
    // Activate-path owners leave invited_by null → deliberateTeamActionCount stays 0.
    assert.equal(
      isYourPeopleComplete({ deliberateTeamActionCount: 0, soloConfirmed: false }),
      false,
    );
    const page = readFileSync(resolve("app/(app)/setup-hub/page.tsx"), "utf8");
    assert.match(page, /invitedByUserId/);
    assert.match(page, /deliberateTeamActionCount/);
    assert.doesNotMatch(page, /hasActiveOwner/);
  });

  it("deliberate Team invite/action completes without requiring acceptance", () => {
    assert.equal(
      isYourPeopleComplete({ deliberateTeamActionCount: 1, soloConfirmed: false }),
      true,
    );
  });

  it("solo confirmation completes and is the only non-invite path", () => {
    assert.equal(
      isYourPeopleComplete({ deliberateTeamActionCount: 0, soloConfirmed: true }),
      true,
    );
  });

  it("solo option is reachable when Team is unresolved", () => {
    const overview = readFileSync(resolve("components/setup-hub/setup-hub-overview.tsx"), "utf8");
    assert.match(overview, /!yourTeamDone/);
    assert.match(overview, /It's just me for now/);
    assert.match(overview, /setYourTeamSoloAction/);
    assert.doesNotMatch(overview, /hasActiveOwner/);
    assert.doesNotMatch(overview, /additionalTeamCount/);
  });

  it("does not require visiting Dashboard or Team page for the checkmark", () => {
    const overview = readFileSync(resolve("components/setup-hub/setup-hub-overview.tsx"), "utf8");
    assert.match(overview, /isYourPeopleComplete/);
    assert.doesNotMatch(overview, /teamVisited|openedTeam|yourTeamVisited|dashboard/);
  });

  it("uses invited_by provenance from Team service mapping", () => {
    const service = readFileSync(resolve("lib/team/service.ts"), "utf8");
    assert.match(service, /invitedByUserId/);
    assert.match(service, /invited_by/);
    const types = readFileSync(resolve("lib/team/types.ts"), "utf8");
    assert.match(types, /invitedByUserId/);
  });
});

describe("Bring Your Business completion — explicit path or Migration Center", () => {
  it("explicit individual completes", () => {
    assert.equal(
      isBringYourBusinessComplete({ hasMigrationImport: false, path: "individual" }),
      true,
    );
  });

  it("explicit skipped completes", () => {
    assert.equal(
      isBringYourBusinessComplete({ hasMigrationImport: false, path: "skipped" }),
      true,
    );
  });

  it("Migration Center import completes", () => {
    assert.equal(
      isBringYourBusinessComplete({ hasMigrationImport: true, path: null }),
      true,
    );
  });

  it("unrelated spreadsheet/HQ import does not complete without a path", () => {
    assert.equal(
      isBringYourBusinessComplete({ hasMigrationImport: false, path: null }),
      false,
    );
    const page = readFileSync(resolve("app/(app)/setup-hub/page.tsx"), "utf8");
    assert.match(page, /migrationSessionId/);
    assert.match(page, /hasMigrationImport/);
    const batches = readFileSync(resolve("lib/import/batches.ts"), "utf8");
    assert.match(batches, /migrationSessionId/);
    assert.match(batches, /migration_session_id/);
  });

  it("does not use bare hasImportedData for completion", () => {
    const overview = readFileSync(resolve("components/setup-hub/setup-hub-overview.tsx"), "utf8");
    assert.match(overview, /isBringYourBusinessComplete\(\{\s*hasMigrationImport/);
    assert.doesNotMatch(overview, /isBringYourBusinessComplete\(\{\s*hasImportedData/);
  });
});

describe("other category completion", () => {
  it("calendar completes from spaces/mode, not a review click", () => {
    assert.equal(isCalendarAvailabilityComplete({ spaceOperatingMode: "single", spacesCount: 0 }), true);
    assert.equal(isCalendarAvailabilityComplete({ spaceOperatingMode: "multi", spacesCount: 2 }), true);
    assert.equal(isCalendarAvailabilityComplete({ spaceOperatingMode: "multi", spacesCount: 0 }), false);
    const overview = readFileSync(resolve("components/setup-hub/setup-hub-overview.tsx"), "utf8");
    assert.doesNotMatch(overview, /calendarAvailabilityReviewedAt/);
    assert.doesNotMatch(overview, /I've thought this through/);
  });

  it("existing authored offerings satisfy without visiting Library", () => {
    assert.equal(
      isYourOfferingsComplete({ authoredPackageCount: 1, authoredInventoryCount: 0, reviewedAt: null }),
      true,
    );
    assert.equal(
      isYourOfferingsComplete({ authoredPackageCount: 0, authoredInventoryCount: 0, reviewedAt: null }),
      false,
    );
    assert.equal(
      isYourOfferingsComplete({ authoredPackageCount: 0, authoredInventoryCount: 0, reviewedAt: "2026-10-01" }),
      true,
    );
  });

  it("visiting is not a completion signal — missing work stays incomplete", () => {
    assert.equal(
      isClientExperienceComplete({ authoredTemplateCount: 0, reviewedAt: null }),
      false,
    );
    assert.equal(isBringYourBusinessComplete({ hasMigrationImport: false, path: null }), false);
    assert.equal(isFinancialsComplete({ stripeConnected: false, reviewedAt: null }), false);
    assert.equal(isLeadCaptureComplete(null, []), false);
  });

  it("lead capture is deterministic from path and channels, not readiness", () => {
    assert.equal(isLeadCaptureComplete("manual_external", []), true);
    assert.equal(
      isLeadCaptureComplete("automated", [{ channel: "website_form", configuredAt: "t", verifiedAt: null }]),
      false,
    );
    assert.equal(
      isLeadCaptureComplete("automated", [{ channel: "website_form", configuredAt: "t", verifiedAt: "t" }]),
      true,
    );
    const src = readFileSync(resolve("lib/setup-hub/stage-completion.ts"), "utf8");
    assert.match(src, /ready_to_invite_couples is independent/);
  });

  it("Setup Hub uploaded-materials copy uses one/ones with file/files", () => {
    const overview = readFileSync(resolve("components/setup-hub/setup-hub-overview.tsx"), "utf8");
    assert.match(
      overview,
      /turn the \$\{uploadedMaterialsCount === 1 \? "one that matters" : "ones that matter"\} into templates/,
    );
    assert.match(overview, /file\$\{uploadedMaterialsCount === 1 \? "" : "s"\}/);
  });
});

describe("operational access is unchanged by category completion", () => {
  it("layout and dashboard still ignore category checkmarks", () => {
    const layout = readFileSync(resolve("app/(app)/layout.tsx"), "utf8");
    const dashboard = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
    assert.doesNotMatch(layout, /isYourVenueComplete|stage-completion/);
    assert.doesNotMatch(dashboard, /isYourVenueComplete|stage-completion/);
    assert.doesNotMatch(layout, /isVenueReadyToInviteCouples/);
  });
});

describe("regression — Concierge / readiness / Vendor / Planning untouched", () => {
  it("Setup Concierge still stops when readyToInviteCouples is true", () => {
    const select = readFileSync(resolve("lib/setup-concierge/select.ts"), "utf8");
    assert.match(select, /if \(snapshot\.readyToInviteCouples\) return null/);
  });

  it("Dashboard remains free of Setup Concierge", () => {
    const dashboard = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
    assert.doesNotMatch(dashboard, /SetupConciergeCard|loadSetupConciergeEntry|Next in setup/);
  });

  it("Setup Hub readiness copy and write path remain", () => {
    const readiness = readFileSync(resolve("components/setup-hub/setup-readiness.tsx"), "utf8");
    assert.match(
      readiness,
      /You&apos;ve decided you&apos;re ready\. We&apos;ll stop showing setup guidance/,
    );
    assert.match(readiness, /We&apos;re ready to start working with couples/);
    assert.match(readiness, /We need a bit more time/);
  });

  it("does not alter Vendor required booking or Planning provision", () => {
    const completion = readFileSync(resolve("lib/setup-hub/stage-completion.ts"), "utf8");
    assert.doesNotMatch(completion, /is_required|is_in_house|book_relationship|PB-CLIENT-01|seedPlaybookStarters/);
    const overview = readFileSync(resolve("components/setup-hub/setup-hub-overview.tsx"), "utf8");
    assert.doesNotMatch(overview, /requiredVendorIds|is_required/);
  });
});
