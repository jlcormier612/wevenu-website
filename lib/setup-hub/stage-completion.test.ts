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

describe("Your People completion", () => {
  it("is complete for a venue operating solo with an active owner", () => {
    assert.equal(
      isYourPeopleComplete({ additionalTeamCount: 0, hasActiveOwner: true, soloConfirmed: false }),
      true,
    );
  });

  it("stays complete when an additional teammate is added", () => {
    const solo = isYourPeopleComplete({ additionalTeamCount: 0, hasActiveOwner: true, soloConfirmed: false });
    const withTeam = isYourPeopleComplete({ additionalTeamCount: 1, hasActiveOwner: true, soloConfirmed: false });
    assert.equal(solo, true);
    assert.equal(withTeam, true);
  });

  it("does not require visiting Team", () => {
    const overview = readFileSync(resolve("components/setup-hub/setup-hub-overview.tsx"), "utf8");
    assert.match(overview, /isYourPeopleComplete/);
    assert.doesNotMatch(overview, /teamVisited|openedTeam|yourTeamVisited/);
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
    assert.equal(isBringYourBusinessComplete({ hasImportedData: false, path: null }), false);
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
