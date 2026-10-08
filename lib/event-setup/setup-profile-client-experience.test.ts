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
  it("explains preset client experience and Invite to portal next step", () => {
    assert.match(section, /setup-profile-explanation/);
    assert.match(section, /Set up the client experience/);
    assert.match(section, /preset in their client portal/);
    assert.match(section, /starting choices/);
    assert.match(section, /Invite to portal/);
    assert.match(bookingModel, /Invite to portal/);
    assert.doesNotMatch(section, /cannot be skipped/);
    assert.doesNotMatch(section, /template_refs|starter flags|snapshots/i);
  });
});

describe("Planning uses active Client Planning library templates", () => {
  it("filters playbooks to client kind, not venue", () => {
    assert.match(page, /template\.kind === "client"/);
    assert.doesNotMatch(page, /template\.kind === "venue"/);
    assert.match(section, /setup-profile-default-planning/);
    assert.match(section, /Starting client planning checklist/);
    assert.match(section, /Client Planning templates/);
  });

  it("sanitizes stale refs that are not in the client library option list", () => {
    assert.match(section, /sanitizeRefsAgainstLibrary/);
    assert.match(section, /playbookIds\.has\(planningId\)/);
  });

  it("inherit applies only active kind=client playbooks", () => {
    assert.match(inherit, /template\.kind === "client"/);
    assert.match(inherit, /getTemplate\(playbookId\)/);
  });

  it("save drops a planning ref that is not an active client playbook", () => {
    const profiles = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    assert.match(profiles, /playbook\.kind !== "client"/);
    assert.match(profiles, /playbook\.is_archived/);
    assert.match(profiles, /planningPlaybookTemplateId = null/);
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
  it("describes prepare-and-send semantics and applies drafts at inherit", () => {
    assert.match(section, /setup-profile-questionnaires/);
    assert.match(section, /Questionnaires to prepare for the client/);
    assert.match(section, /set up as drafts/);
    assert.match(section, /until you send them/);
    assert.match(inherit, /applyInheritedQuestionnaires/);
    assert.match(inherit, /applyTemplateToEvent/);
    assert.doesNotMatch(inherit, /sendQuestionnaireToCouple/);
  });
});

describe("Vendors: recommended = client-facing; required from Vendor Network", () => {
  it("keeps multi-select and seeds only recommended vendors at inherit", () => {
    assert.match(section, /setup-profile-vendors/);
    assert.doesNotMatch(section, /Vendors your team expects to book/);
    assert.match(section, /Recommended vendors for the client/);
    assert.match(section, /Required vendors are managed in your Vendor Network/);
    assert.match(section, /appear as recommendations the client can review/);
    assert.match(inherit, /applyInheritedVendorRecommendations/);
    assert.match(inherit, /recommendedVendorIds/);
    assert.match(inherit, /addRecommendation/);
    assert.doesNotMatch(inherit, /requiredVendorIds/);
    assert.doesNotMatch(inherit, /assignVendor/);
  });
});
