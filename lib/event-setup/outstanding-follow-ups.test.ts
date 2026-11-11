import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SETUP_READINESS_LABEL } from "@/lib/event-setup/readiness-detail";
import {
  isOutstandingFollowUp,
  setupStatusBadgeLabel,
} from "@/lib/event-setup/outstanding-follow-ups";

describe("isOutstandingFollowUp", () => {
  it("excludes undecided and skipped rows from the Outstanding list", () => {
    assert.equal(isOutstandingFollowUp(null, "needs_action"), false);
    assert.equal(isOutstandingFollowUp(undefined, "needs_action"), false);
    assert.equal(isOutstandingFollowUp("skipped", "not_included"), false);
  });

  it("treats Draft as prepared/recoverable content — not an outstanding blocker", () => {
    assert.equal(isOutstandingFollowUp("set_up", "draft"), false);
    assert.equal(isOutstandingFollowUp("set_up", "draft", "planning"), false);
    assert.equal(isOutstandingFollowUp("set_up", "draft", "inventory"), false);
    assert.equal(isOutstandingFollowUp("set_up", "draft", "event_order"), false);
    assert.equal(isOutstandingFollowUp("set_up", "included"), false);
    assert.equal(isOutstandingFollowUp("set_up", "shared"), false);
  });

  it("keeps genuine unavailable and needs_action as outstanding", () => {
    assert.equal(isOutstandingFollowUp("set_up", "unavailable"), true);
    assert.equal(isOutstandingFollowUp("set_up", "needs_action"), true);
    assert.equal(isOutstandingFollowUp("set_up", "needs_action", "inventory"), true);
  });

  it("excludes questionnaires from portal settle blockers", () => {
    assert.equal(isOutstandingFollowUp("set_up", "draft", "questionnaires"), false);
    assert.equal(isOutstandingFollowUp("set_up", "needs_action", "questionnaires"), false);
    assert.equal(isOutstandingFollowUp("set_up", "unavailable", "event_order"), true);
  });
});

describe("setupStatusBadgeLabel", () => {
  it("labels undecided needs_action as Decide, not Needs action", () => {
    assert.equal(setupStatusBadgeLabel(null, "needs_action", SETUP_READINESS_LABEL), "Decide");
    assert.equal(setupStatusBadgeLabel("set_up", "needs_action", SETUP_READINESS_LABEL), "Needs action");
    assert.equal(setupStatusBadgeLabel("set_up", "draft", SETUP_READINESS_LABEL), "Draft");
  });

  it("presents shared lifecycle as Released on Overview badges", () => {
    assert.equal(setupStatusBadgeLabel("set_up", "shared", SETUP_READINESS_LABEL), "Released");
  });

  it("presents Planning draft inclusion as Included, not Draft", () => {
    assert.equal(setupStatusBadgeLabel("set_up", "draft", SETUP_READINESS_LABEL, "planning"), "Included");
  });

  it("presents Inventory draft inclusion as Included, not Draft", () => {
    assert.equal(setupStatusBadgeLabel("set_up", "draft", SETUP_READINESS_LABEL, "inventory"), "Included");
    assert.equal(setupStatusBadgeLabel("set_up", "included", SETUP_READINESS_LABEL, "inventory"), "Included");
    assert.equal(setupStatusBadgeLabel("set_up", "needs_action", SETUP_READINESS_LABEL, "inventory"), "Needs action");
  });

  it("presents Event Order draft inclusion as Included on Overview, not Draft", () => {
    assert.equal(setupStatusBadgeLabel("set_up", "draft", SETUP_READINESS_LABEL, "event_order"), "Included");
    assert.equal(setupStatusBadgeLabel("set_up", "included", SETUP_READINESS_LABEL, "event_order"), "Included");
    assert.equal(setupStatusBadgeLabel("set_up", "shared", SETUP_READINESS_LABEL, "event_order"), "Released");
    assert.equal(setupStatusBadgeLabel("set_up", "needs_action", SETUP_READINESS_LABEL, "event_order"), "Needs action");
    // Without the Overview step key, readiness Draft label is unchanged elsewhere.
    assert.equal(setupStatusBadgeLabel("set_up", "draft", SETUP_READINESS_LABEL), "Draft");
  });
});

describe("setupStepTemplateLabel", () => {
  it("prefers the applied client checklist name over the profile planning ref name", async () => {
    const { setupStepTemplateLabel } = await import("@/lib/event-setup/outstanding-follow-ups");
    assert.equal(
      setupStepTemplateLabel(
        "planning",
        { planning: "Profile ref name", timeline: null, inventory: null, eventOrder: null },
        { clientChecklistName: "Standard Wedding — Client Planning" },
      ),
      "Standard Wedding — Client Planning",
    );
  });
});
