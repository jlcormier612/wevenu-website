import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isDashboardLevel1Observation, selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";
import { filterVisibleObservations } from "@/lib/luv/observation-dismiss";
import type { VenueRecommendation } from "@/lib/luv/recommendation-types";
import {
  assessVenueReadiness,
  emptyReadinessFacts,
  intakeReady,
  profileContactReady,
  readinessDashboardObservations,
  type VenueReadinessFacts,
} from "@/lib/luv/venue-readiness";

function readyVenue(overrides: Partial<VenueReadinessFacts> = {}): VenueReadinessFacts {
  return emptyReadinessFacts({
    hasName: true,
    hasEmail: true,
    hasPhone: true,
    hasAddress: true,
    hasLogo: true,
    hasTimezone: true,
    inquiryFormReady: true,
    inquiryFormReceivedLead: true,
    emailIntakeEnabled: true,
    emailIntakeAcceptedLead: true,
    facebook: "absent",
    leadCapturePath: "automated",
    tourSchedulingEnabled: true,
    tourWindowCount: 2,
    authoredPackageCount: 1,
    authoredContractTemplateCount: 1,
    authoredMessageTemplateCount: 1,
    playbookCount: 1,
    authoredInventoryCount: 1,
    stripeChargesEnabled: true,
    spaceOperatingMode: "multi",
    spaceCount: 1,
    ...overrides,
  });
}

function keys(facts: VenueReadinessFacts) {
  return assessVenueReadiness(facts).findings.map((f) => f.key);
}

describe("venue readiness — authoritative detection", () => {
  it("finds nothing on a complete venue", () => {
    const assessment = assessVenueReadiness(readyVenue());
    assert.deepEqual(assessment.findings, []);
    assert.match(assessment.opening, /You're in good shape/);
    assert.equal(assessment.next, null);
  });

  it("classifies a missing profile and a missing own package as blockers", () => {
    const assessment = assessVenueReadiness(readyVenue({
      hasEmail: false,
      hasPhone: false,
      authoredPackageCount: 0,
    }));
    const blockers = assessment.findings.filter((f) => f.importance === "blocker");
    assert.deepEqual(blockers.map((f) => f.key), ["profile_contact", "own_package"]);
    assert.match(blockers[0].why, /email or phone/i);
    assert.equal(blockers[0].href, "/settings");
    assert.match(blockers[1].why, /Starter examples don't count/);
    assert.equal(blockers[1].href, "/library/packages");
  });

  it("classifies contract, card payments, and tour hours as recommended", () => {
    const assessment = assessVenueReadiness(readyVenue({
      authoredContractTemplateCount: 0,
      stripeChargesEnabled: false,
      tourWindowCount: 0,
    }));
    const recommended = assessment.findings.filter((f) => f.importance === "recommended");
    assert.deepEqual(recommended.map((f) => f.key), ["own_contract", "card_payments", "tour_hours"]);
    assert.match(recommended[1].why, /charges are enabled/);
    assert.equal(recommended[1].href, "/settings/integrations");
    assert.match(recommended[2].why, /Nobody can book a tour/);
    assert.equal(recommended[2].href, "/settings/availability");
  });

  it("classifies logo, message templates, planning, and inventory as optional", () => {
    const found = assessVenueReadiness(readyVenue({
      hasLogo: false,
      authoredMessageTemplateCount: 0,
      playbookCount: 0,
      authoredInventoryCount: 0,
    })).findings;
    assert.deepEqual(found.map((f) => f.importance), ["optional", "optional", "optional", "optional"]);
    assert.equal(found[0].href, "/settings");
    assert.match(found[0].why, /still work without it/);
  });

  it("does not treat a single-space venue with zero spaces as a gap", () => {
    assert.equal(keys(readyVenue({ spaceOperatingMode: "single", spaceCount: 0 })).includes("event_spaces"), false);
  });

  it("recommends a space only when the venue operates more than one", () => {
    const found = assessVenueReadiness(readyVenue({ spaceOperatingMode: "multi", spaceCount: 0 }))
      .findings.find((f) => f.key === "event_spaces");
    assert.equal(found?.importance, "recommended");
    assert.equal(found?.href, "/settings/availability");
  });
});

describe("venue readiness — lead intake is not a click", () => {
  it("blocks when no real intake exists and the venue has not chosen manual entry", () => {
    const found = assessVenueReadiness(readyVenue({
      inquiryFormReceivedLead: false,
      emailIntakeEnabled: false,
      emailIntakeAcceptedLead: false,
      facebook: "absent",
      leadCapturePath: null,
      tourSchedulingEnabled: false,
      tourWindowCount: 0,
    })).findings.find((f) => f.key === "lead_intake");
    assert.equal(found?.importance, "blocker");
    assert.equal(found?.href, "/setup-hub/lead-capture");
    assert.match(found?.why ?? "", /won't become a lead/);
    assert.match(found?.resolvedWhen ?? "", /Opening this page does not count/);
  });

  it("resolves when the owner chose to add leads themselves", () => {
    assert.equal(intakeReady(readyVenue({
      inquiryFormReceivedLead: false,
      emailIntakeAcceptedLead: false,
      facebook: "absent",
      tourSchedulingEnabled: false,
      tourWindowCount: 0,
      leadCapturePath: "manual_external",
    })), true);
    assert.equal(keys(readyVenue({
      inquiryFormReceivedLead: false,
      leadCapturePath: "manual_external",
    })).includes("lead_intake"), false);
    assert.equal(keys(readyVenue({
      inquiryFormReceivedLead: false,
      leadCapturePath: "manual_external",
    })).includes("share_inquiry_form"), false);
  });

  it("resolves the intake blocker from a real website inquiry, not from a configured flag", () => {
    const before = keys(readyVenue({
      inquiryFormReceivedLead: false,
      emailIntakeEnabled: false,
      emailIntakeAcceptedLead: false,
      leadCapturePath: "automated",
      tourSchedulingEnabled: false,
      facebook: "absent",
    }));
    assert.equal(before.includes("lead_intake"), true);
    const after = keys(readyVenue({
      inquiryFormReceivedLead: true,
      emailIntakeEnabled: false,
      emailIntakeAcceptedLead: false,
      leadCapturePath: "automated",
      tourSchedulingEnabled: false,
      facebook: "absent",
    }));
    assert.equal(after.includes("lead_intake"), false);
  });

  it("keeps the website form open until an inquiry arrives, even when another channel works", () => {
    const found = assessVenueReadiness(readyVenue({
      inquiryFormReceivedLead: false,
      emailIntakeAcceptedLead: true,
      leadCapturePath: "automated",
    })).findings.find((f) => f.key === "share_inquiry_form");
    assert.equal(found?.importance, "recommended");
    assert.match(found?.why ?? "", /can't see your website/);
    assert.match(found?.resolvedWhen ?? "", /configured does not count/);
  });

  it("does not invent an intake gap when the lookup failed", () => {
    const found = keys(readyVenue({
      inquiryFormReceivedLead: null,
      emailIntakeAcceptedLead: null,
      leadCapturePath: null,
      leadCapturePathKnown: false,
      facebook: "absent",
      tourSchedulingEnabled: false,
      tourWindowCount: null,
    }));
    assert.equal(found.includes("lead_intake"), false);
  });

  it("does not call card payments ready from anything except charges enabled", () => {
    assert.equal(keys(readyVenue({ stripeChargesEnabled: false })).includes("card_payments"), true);
    assert.equal(keys(readyVenue({ stripeChargesEnabled: true })).includes("card_payments"), false);
  });
});

describe("venue readiness — resolution, dismissal, dashboard quietness", () => {
  it("drops a blocker once the underlying count changes", () => {
    assert.equal(profileContactReady(readyVenue({ hasAddress: false })), false);
    const missing = assessVenueReadiness(readyVenue({ authoredPackageCount: 0 }));
    assert.equal(missing.findings.some((f) => f.key === "own_package"), true);
    const fixed = assessVenueReadiness(readyVenue({ authoredPackageCount: 1 }));
    assert.equal(fixed.findings.some((f) => f.key === "own_package"), false);
  });

  it("does not put recommended or optional findings on the dashboard", () => {
    const assessment = assessVenueReadiness(readyVenue({
      hasLogo: false,
      authoredContractTemplateCount: 0,
      stripeChargesEnabled: false,
    }));
    assert.deepEqual(readinessDashboardObservations(assessment), []);
  });

  it("offers only the first blocker to the dashboard, and dismissal hides it", () => {
    const assessment = assessVenueReadiness(readyVenue({
      hasAddress: false,
      authoredPackageCount: 0,
    }));
    const observations = readinessDashboardObservations(assessment);
    assert.equal(observations.length, 1);
    assert.equal(observations[0].id, "venue-readiness-profile_contact");
    assert.equal(isDashboardLevel1Observation(observations[0]), true);
    const hidden = filterVisibleObservations(observations, new Set(["venue-readiness-profile_contact"]));
    assert.deepEqual(hidden, []);
  });

  it("lets an existing Level-1 recommendation keep the dashboard card", () => {
    const readiness = readinessDashboardObservations(assessVenueReadiness(readyVenue({ authoredPackageCount: 0 })));
    const recommendation = {
      id: "rec-1",
      type: "tour_followup_pattern",
      title: "Several tours never got a follow-up.",
      body: "That's a pattern worth closing.",
      ctas: [{ type: "navigate", label: "Review tours", target: "/tours" }],
      priority: "high",
      venueId: "v",
      createdAt: "2026-09-29T00:00:00Z",
      dismissedAt: null,
      status: "active",
    } as unknown as VenueRecommendation;
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: readiness,
      recommendations: [recommendation],
    });
    assert.equal(entry?.actionHref, "/tours");
    assert.match(entry?.message ?? "", /follow-up/);
  });

  it("does not praise every remaining checkbox when a blocker is still open", () => {
    const assessment = assessVenueReadiness(readyVenue({
      authoredPackageCount: 0,
      hasLogo: false,
      playbookCount: 0,
    }));
    assert.doesNotMatch(assessment.opening, /logo/i);
    assert.match(assessment.next ?? "", /Want to tackle that with me/);
  });
});

describe("venue readiness — tenant scoping and no second system", () => {
  it("loads only the current venue and ignores channel click acknowledgements", () => {
    const source = readFileSync(resolve("lib/luv/venue-readiness-load.ts"), "utf8");
    assert.match(source, /getCurrentVenue\(/);
    assert.match(source, /\.eq\("venue_id", venueId\)/);
    assert.doesNotMatch(source, /venue_users/);
    assert.doesNotMatch(source, /limit\(1\)/i);
    assert.doesNotMatch(source, /configured_at/);
    assert.doesNotMatch(source, /verified_at/);
    assert.match(source, /stripe_charges_enabled/);
    assert.match(source, /source_master_key/);
  });

  it("appends dashboard readiness after existing observations and does not add a table", () => {
    const dashboard = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
    const setupIdx = dashboard.indexOf("...setupGapObservations");
    const readyIdx = dashboard.indexOf("...readinessObservations");
    assert.ok(setupIdx > 0 && readyIdx > setupIdx);
    const readiness = readFileSync(resolve("lib/luv/venue-readiness.ts"), "utf8");
    assert.doesNotMatch(readiness, /create table/i);
    assert.doesNotMatch(readiness, /insert into/i);
  });
});
