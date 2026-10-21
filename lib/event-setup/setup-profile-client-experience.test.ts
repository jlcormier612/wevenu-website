/**
 * Setup Profile — customer-facing client experience model.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const section = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
const page = readFileSync(resolve("app/(app)/settings/leads/setup-profiles/page.tsx"), "utf8");
const inherit = readFileSync(resolve("lib/event-setup/inherit.ts"), "utf8");
const bookingModel = readFileSync(resolve("lib/booking-journey/model.ts"), "utf8");

describe("Setup Profile client experience copy", () => {
  it("explains preset client experience and Invite client next step", () => {
    assert.match(section, /setup-profile-explanation/);
    assert.match(section, /Set up the client experience/);
    assert.match(section, /preset in their client portal/);
    assert.match(section, /starting choices/);
    assert.match(section, /Invite client/);
    assert.match(bookingModel, /Invite client/);
    assert.doesNotMatch(section, /Invite to portal/);
    assert.doesNotMatch(bookingModel, /Invite to portal/);
    assert.doesNotMatch(section, /Invite to portalfrom/);
    assert.doesNotMatch(section, /cannot be skipped/);
    assert.doesNotMatch(section, /template_refs|starter flags|snapshots/i);
  });
});

describe("Planning uses active Client and Venue Planning library templates", () => {
  it("filters playbooks into client and venue option lists", () => {
    assert.match(page, /template\.kind === "client"/);
    assert.match(page, /template\.kind === "venue"/);
    assert.match(page, /venuePlaybooks=\{/);
    assert.match(section, /setup-profile-default-planning/);
    assert.match(section, /setup-profile-default-venue-planning/);
    assert.match(section, /Starting client planning checklist/);
    assert.match(section, /Starting venue\/internal planning checklist/);
    assert.match(section, /Client Planning templates/);
    assert.match(section, /Venue Planning templates/);
  });

  it("sanitizes stale refs that are not in the matching library option list", () => {
    assert.match(section, /sanitizeRefsAgainstLibrary/);
    assert.match(section, /playbookIds\.has\(planningId\)/);
    assert.match(section, /venuePlaybookIds\.has\(venuePlanningId\)/);
  });

  it("inherit applies active kind=client and kind=venue playbooks from the profile", () => {
    assert.match(inherit, /template\.kind === "client"/);
    assert.match(inherit, /template\.kind !== "venue"/);
    assert.match(inherit, /getTemplate\(playbookId\)/);
    assert.match(inherit, /applyProfileVenuePlaybook/);
    assert.match(inherit, /venuePlanningPlaybookTemplateId/);
  });

  it("save drops planning refs that are not the correct active playbook kind", () => {
    const profiles = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    assert.match(profiles, /playbook\.kind !== "client"/);
    assert.match(profiles, /playbook\.kind !== "venue"/);
    assert.match(profiles, /playbook\.is_archived/);
    assert.match(profiles, /planningPlaybookTemplateId = null/);
    assert.match(profiles, /venuePlanningPlaybookTemplateId = null/);
  });
});

describe("Timeline remains one starting default", () => {
  it("keeps a single timeline select over active library templates", () => {
    assert.match(section, /setup-profile-default-timeline/);
    assert.match(section, /Starting timeline/);
    assert.match(page, /timelines=\{timelines\.filter\(\(template\) => !template\.isArchived\)/);
    assert.match(inherit, /Default timeline only/);
    assert.doesNotMatch(inherit, /timelineTemplateIds/);
  });
});

describe("Floor plans support multiple client-selectable options", () => {
  it("exposes multi-select options plus preferred starting plan", () => {
    assert.match(section, /setup-profile-floor-plans/);
    assert.match(section, /Floor plans clients can choose from/);
    assert.match(section, /Preferred starting plan/);
    assert.match(section, /setup-profile-default-floor-plan/);
    assert.match(section, /floorPlanTemplateIds/);
    assert.doesNotMatch(section, /floorPlanTemplateIds:\s*\[\]/);
  });

  it("inherits offered floor plans onto the event for the client chooser", () => {
    assert.match(inherit, /applyInheritedFloorPlanOffers/);
    assert.match(inherit, /upsertOffer/);
    assert.match(inherit, /event_floor_plan_offers/);
    assert.match(inherit, /defaultFloorPlanTemplateId/);
    assert.match(inherit, /floorPlanTemplateIds/);
  });
});

describe("Questionnaires are multi-select drafts, not auto-sent", () => {
  it("describes separate schedule semantics and applies drafts at inherit", () => {
    assert.match(section, /setup-profile-questionnaires/);
    assert.match(section, /Questionnaires for this event type/);
    assert.match(section, /prepared as drafts at booking/);
    assert.match(section, /Preparing and releasing the portal never sends them/);
    assert.match(inherit, /applyInheritedQuestionnaires/);
    assert.match(inherit, /applyQuestionnaireTemplateSnapshot/);
    assert.doesNotMatch(inherit, /sendQuestionnaireToCouple/);
  });
});

describe("Vendors: Vendor Network classifications are authoritative", () => {
  it("explains preferred/recommended/required without a second recommendation picker", () => {
    assert.match(section, /setup-profile-vendors/);
    assert.match(section, /Vendor Network/);
    assert.match(section, /Preferred, recommended, and required classifications/);
    assert.match(section, /You do not select a second recommendation list here/);
    assert.match(section, /Required vendors/);
    assert.doesNotMatch(section, /Optional recommendations/);
    assert.doesNotMatch(section, /Vendors your team expects to book/);
    assert.doesNotMatch(section, /Recommended vendors for the client/);
    assert.match(inherit, /Vendor Network classifications are authoritative/);
    assert.doesNotMatch(inherit, /applyInheritedVendorRecommendations/);
    assert.doesNotMatch(inherit, /addRecommendation/);
    assert.doesNotMatch(inherit, /assignVendor/);
  });
});
