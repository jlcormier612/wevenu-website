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

  it("includes Included areas that are still draft, unavailable, or missing artifacts", () => {
    assert.equal(isOutstandingFollowUp("set_up", "draft"), true);
    assert.equal(isOutstandingFollowUp("set_up", "unavailable"), true);
    assert.equal(isOutstandingFollowUp("set_up", "needs_action"), true);
    assert.equal(isOutstandingFollowUp("set_up", "included"), false);
    assert.equal(isOutstandingFollowUp("set_up", "shared"), false);
  });

  it("excludes questionnaires and Event Order drafts from portal settle blockers", () => {
    assert.equal(isOutstandingFollowUp("set_up", "draft", "questionnaires"), false);
    assert.equal(isOutstandingFollowUp("set_up", "needs_action", "questionnaires"), false);
    assert.equal(isOutstandingFollowUp("set_up", "draft", "event_order"), false);
    assert.equal(isOutstandingFollowUp("set_up", "unavailable", "event_order"), true);
  });
});

describe("setupStatusBadgeLabel", () => {
  it("labels undecided needs_action as Decide, not Needs action", () => {
    assert.equal(setupStatusBadgeLabel(null, "needs_action", SETUP_READINESS_LABEL), "Decide");
    assert.equal(setupStatusBadgeLabel("set_up", "needs_action", SETUP_READINESS_LABEL), "Needs action");
    assert.equal(setupStatusBadgeLabel("set_up", "draft", SETUP_READINESS_LABEL), "Draft");
  });
});
