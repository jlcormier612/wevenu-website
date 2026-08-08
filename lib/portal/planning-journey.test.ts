import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PLANNING_JOURNEY_MILESTONES,
  planningJourneyCurrentIndex,
  planningJourneyNarrative,
  resolvePlanningJourney,
} from "@/lib/portal/planning-journey";

describe("Wedding Journey (date-based PlanningJourney)", () => {
  it("preserves existing milestone thresholds and count", () => {
    assert.equal(PLANNING_JOURNEY_MILESTONES.length, 6);
    assert.deepEqual(
      PLANNING_JOURNEY_MILESTONES.map((m) => m.threshold),
      [365, 270, 180, 90, 30, 0],
    );
  });

  it("uses the Phase 1 current-index rule", () => {
    assert.equal(planningJourneyCurrentIndex(400), 0); // early / 12 mo chapter
    assert.equal(planningJourneyCurrentIndex(200), 2); // 6 mo
    assert.equal(planningJourneyCurrentIndex(50), 4); // 1 mo
    assert.equal(planningJourneyCurrentIndex(10), 5); // Day chapter (existing)
    assert.equal(planningJourneyCurrentIndex(0), 5); // wedding day
  });

  it("marks Past / Now / Next without task counts or percentages", () => {
    const model = resolvePlanningJourney(50);
    assert.equal(model.kind, "dated");
    if (model.kind !== "dated") return;

    assert.equal(model.currentId, "1mo");
    assert.equal(model.steps.filter((s) => s.state === "completed").length, 4);
    assert.equal(model.steps.find((s) => s.id === "1mo")?.state, "current");
    assert.equal(model.steps.find((s) => s.id === "1mo")?.statusLabel, "You’re here");
    assert.equal(model.steps.find((s) => s.id === "day")?.state, "upcoming");
    assert.equal(model.steps.find((s) => s.id === "day")?.statusLabel, "Ahead");

    assert.doesNotMatch(model.narrative, /%|task|overdue|next steps/i);
    assert.doesNotMatch(model.accessibleSummary, /\d+%/);
    assert.match(model.accessibleSummary, /About a month out/i);
  });

  it("elevates Wedding Day when daysUntil is 0", () => {
    const model = resolvePlanningJourney(0);
    assert.equal(model.kind, "dated");
    if (model.kind !== "dated") return;
    assert.equal(model.isWeddingDay, true);
    assert.equal(model.currentId, "day");
    assert.equal(model.steps.every((s) => s.id === "day" || s.state === "completed"), true);
    assert.equal(model.steps.find((s) => s.id === "day")?.state, "wedding_day");
    assert.match(model.narrative, /wedding day/i);
  });

  it("returns an undated invitation when there is no event date", () => {
    const model = resolvePlanningJourney(null);
    assert.equal(model.kind, "undated");
    if (model.kind !== "undated") return;
    assert.match(model.narrative, /wedding date/i);
    assert.doesNotMatch(model.narrative, /%/);
  });

  it("does not invent stages for post-wedding (date mode owns celebration)", () => {
    const model = resolvePlanningJourney(-2);
    assert.equal(model.kind, "undated");
  });

  it("keeps narratives emotional and date-driven across early / mid / late", () => {
    assert.match(planningJourneyNarrative(400, 0), /beginning|season/i);
    assert.match(planningJourneyNarrative(200, 2), /early months|rhythm/i);
    assert.match(planningJourneyNarrative(50, 4), /drawing nearer|where you should be/i);
    assert.match(planningJourneyNarrative(10, 5), /final stretch|I do/i);
    assert.match(planningJourneyNarrative(0, 5), /Today is your wedding day/i);
  });
});
