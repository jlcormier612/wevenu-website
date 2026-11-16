import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { experienceToolRows } from "@/lib/setup-hub/phase-b1-experience-resources";

describe("experience resource rows", () => {
  it("does not show resources for Not included tools and does not mark starters Ready", () => {
    const rows = experienceToolRows({
      eventType: "wedding",
      heading: "Prepare your wedding experience",
      decisions: { planning: "set_up", timeline: "skipped", vendors: "set_up" },
      refs: {
        planningPlaybookTemplateId: "pb-client",
        venuePlanningPlaybookTemplateId: "pb-venue",
      },
      playbooks: [
        { id: "pb-client", name: "Wedding Client Planning", sourceMasterKey: "PB-CLIENT-01" },
        { id: "pb-venue", name: "Wedding Venue Planning", sourceMasterKey: "PB-VENUE-01" },
      ],
      timelines: [],
      floorPlans: [],
      questionnaires: [],
      vendors: [],
      spaceCount: 0,
    });
    const planning = rows.find((row) => row.step === "planning");
    const timeline = rows.find((row) => row.step === "timeline");
    const floorPlans = rows.find((row) => row.step === "floor_plans");
    assert.equal(planning?.inclusion, "Included");
    assert.equal(planning?.resources[0]?.designation, "Starter");
    assert.notEqual(planning?.resources[0]?.status, "Ready");
    assert.equal(planning?.resources[0]?.status, "Starter ready for you");
    assert.equal(timeline?.inclusion, "Not included");
    assert.equal(timeline?.resources.length, 0);
    assert.equal(floorPlans?.inclusion, "Optional");
    assert.match(floorPlans?.attention ?? "", /spaces configured/);
  });

  it("surfaces floor-plan space prerequisites without inventing a template", () => {
    const rows = experienceToolRows({
      eventType: "wedding",
      heading: "Prepare your wedding experience",
      decisions: { floor_plans: "set_up" },
      refs: {},
      playbooks: [],
      timelines: [],
      floorPlans: [],
      questionnaires: [],
      vendors: [],
      spaceCount: 0,
    });
    const floorPlans = rows.find((row) => row.step === "floor_plans");
    assert.match(floorPlans?.attention ?? "", /spaces configured/);
    assert.equal(floorPlans?.resources[0]?.status, "Needs attention");
  });
});
