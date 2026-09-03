import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatClientPlanningTitle } from "@/lib/playbooks/constants";
import { resolveExperienceProfileId } from "@/lib/event-experience";

describe("formatClientPlanningTitle — Anniversary vs Wedding-family", () => {
  it("keeps Wedding-family stored types on the existing couple planning title", () => {
    assert.equal(formatClientPlanningTitle("The Gala", "Emily & James", "wedding"), "Emily & James's Planning");
    assert.equal(formatClientPlanningTitle("The Gala", "Emily & James", "elopement"), "Emily & James's Planning");
    assert.equal(
      formatClientPlanningTitle("The Gala", "Emily & James", "engagement_party"),
      "Emily & James's Planning",
    );
  });

  it("does not treat Anniversary as a Wedding-family planning title", () => {
    assert.equal(resolveExperienceProfileId("anniversary"), "anniversary");
    assert.notEqual(resolveExperienceProfileId("anniversary"), "wedding");
    assert.equal(
      formatClientPlanningTitle("The Parkers' 25th", "Emily & James", "anniversary"),
      "The Parkers' 25th Planning",
    );
  });

  it("does not expand the helper to other Wedding-profile stored types that were never in this set", () => {
    assert.equal(resolveExperienceProfileId("rehearsal_dinner"), "wedding");
    assert.equal(resolveExperienceProfileId("reception"), "wedding");
    assert.equal(formatClientPlanningTitle("Friday Dinner", "Emily & James", "rehearsal_dinner"), "Friday Dinner Planning");
    assert.equal(formatClientPlanningTitle("Sunday Reception", "Emily & James", "reception"), "Sunday Reception Planning");
  });

  it("keeps General Event and Corporate on the event-name title", () => {
    assert.equal(formatClientPlanningTitle("Maya's Party", "Maya Lopez", "birthday"), "Maya's Party Planning");
    assert.equal(formatClientPlanningTitle("Q3 Offsite", "Acme", "corporate"), "Q3 Offsite Planning");
  });
});
