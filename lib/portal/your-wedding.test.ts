import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatBudgetMoney,
  resolveBudgetLaunch,
  resolveFloorPlanLaunch,
  resolveGuestsLaunch,
  resolvePlansLaunch,
  resolveSeatingLaunch,
  resolveStoryLaunch,
  resolveWebsiteLaunch,
  websiteCompletionPercent,
} from "@/lib/portal/your-wedding";

describe("websiteCompletionPercent", () => {
  it("matches existing Studio section ratio", () => {
    assert.equal(websiteCompletionPercent(4, 8), 50);
    assert.equal(websiteCompletionPercent(0, 8), 0);
    assert.equal(websiteCompletionPercent(0, 0), 0);
  });
});

describe("resolveWebsiteLaunch", () => {
  it("invites when website does not exist", () => {
    const m = resolveWebsiteLaunch({
      exists: false,
      isPublished: false,
      completedSections: 0,
      totalSections: 8,
    });
    assert.equal(m.status, "Start your wedding website");
    assert.equal(m.cta, "Open Website");
    assert.equal(m.destination, "website");
    assert.equal(m.tone, "invite");
  });

  it("shows published state without opening an editor", () => {
    const m = resolveWebsiteLaunch({
      exists: true,
      isPublished: true,
      completedSections: 8,
      totalSections: 8,
    });
    assert.equal(m.status, "Published ✓");
    assert.equal(m.tone, "complete");
    assert.equal(m.cta, "Open Website");
  });

  it("reuses existing section completion percent when drafting", () => {
    const m = resolveWebsiteLaunch({
      exists: true,
      isPublished: false,
      completedSections: 3,
      totalSections: 6,
    });
    assert.equal(m.status, "50% complete");
    assert.equal(m.tone, "active");
  });
});

describe("resolveGuestsLaunch", () => {
  it("invites when guest list is empty", () => {
    const m = resolveGuestsLaunch(null);
    assert.equal(m.status, "Begin your guest list");
    assert.equal(m.cta, "Open Guest List");
    assert.equal(m.tone, "invite");
  });

  it("shows invited + confirmed counts without RSVP analytics", () => {
    const m = resolveGuestsLaunch({ total: 128, attending: 97 });
    assert.equal(m.status, "128 invited, 97 confirmed");
    assert.equal(m.tone, "active");
  });
});

describe("resolveBudgetLaunch", () => {
  it("uses warm invite when budget is unset", () => {
    const m = resolveBudgetLaunch(null);
    assert.match(m.status, /budget/i);
    assert.doesNotMatch(m.status, /0 items|no data|not configured/i);
    assert.equal(m.cta, "Open Budget");
    assert.equal(m.tone, "invite");
  });

  it("shows spent of total from canonical budget totals", () => {
    const m = resolveBudgetLaunch({ totalBudget: 30000, spent: 24800 });
    assert.equal(m.status, `${formatBudgetMoney(24800)} of ${formatBudgetMoney(30000)}`);
    assert.equal(m.tone, "active");
  });
});

describe("resolveSeatingLaunch", () => {
  it("gently invites when no floor plan is shared", () => {
    const m = resolveSeatingLaunch({
      hasFloorPlan: false,
      hadPriorWork: false,
      unassignedCount: 0,
    });
    assert.match(m.status, /seating|ready/i);
    assert.doesNotMatch(m.status, /0%|not configured/i);
    assert.equal(m.cta, "Open Seating");
    assert.equal(m.tone, "invite");
  });

  it("acknowledges prior work when venue paused sharing", () => {
    const m = resolveSeatingLaunch({
      hasFloorPlan: false,
      hadPriorWork: true,
      unassignedCount: 0,
    });
    assert.match(m.status, /venue shares/i);
  });

  it("shows unassigned count and all-seated without inventing progress", () => {
    assert.equal(
      resolveSeatingLaunch({
        hasFloorPlan: true,
        hadPriorWork: true,
        unassignedCount: 4,
      }).status,
      "4 guests unassigned",
    );
    assert.equal(
      resolveSeatingLaunch({
        hasFloorPlan: true,
        hadPriorWork: true,
        unassignedCount: 0,
      }).status,
      "All guests seated ✓",
    );
  });
});

describe("resolveFloorPlanLaunch", () => {
  it("hides the Your Wedding card when nothing is shared", () => {
    assert.equal(resolveFloorPlanLaunch(null), null);
    assert.equal(resolveFloorPlanLaunch({
      sharedCount: 0,
      hasOperational: false,
      operationalName: null,
    }), null);
  });

  it("uses singular Floor Plan copy and opens floor_plans", () => {
    const m = resolveFloorPlanLaunch({
      sharedCount: 1,
      hasOperational: false,
      operationalName: null,
    });
    assert.ok(m);
    assert.equal(m.label, "Floor Plan");
    assert.equal(m.status, "Shared by your venue");
    assert.equal(m.cta, "Open Floor Plan");
    assert.equal(m.destination, "floor_plans");
    assert.equal(m.tone, "active");
    assert.match(m.accessibleLabel, /Floor Plan/);
  });

  it("reports multiple shared layouts without inventing an operational plan", () => {
    const m = resolveFloorPlanLaunch({
      sharedCount: 3,
      hasOperational: false,
      operationalName: null,
    });
    assert.ok(m);
    assert.equal(m.status, "3 layouts shared");
    assert.equal(m.destination, "floor_plans");
  });

  it("prefers operational plan name when venue set the durable pointer", () => {
    const m = resolveFloorPlanLaunch({
      sharedCount: 2,
      hasOperational: true,
      operationalName: "Barn Ceremony Layout",
    });
    assert.ok(m);
    assert.equal(m.status, "Barn Ceremony Layout");
    assert.equal(m.cta, "Open Floor Plan");
    assert.equal(m.destination, "floor_plans");
    assert.equal(m.tone, "active");
  });

  it("stays independent of seating — seating invite still returns when no seating share", () => {
    // Layout share (this card) does not imply seating readiness.
    assert.ok(resolveFloorPlanLaunch({
      sharedCount: 1,
      hasOperational: true,
      operationalName: "Main",
    }));
    const seating = resolveSeatingLaunch({
      hasFloorPlan: false,
      hadPriorWork: false,
      unassignedCount: 0,
    });
    assert.equal(seating.tone, "invite");
    assert.equal(seating.destination, "seating");
  });
});

describe("resolvePlansLaunch", () => {
  it("prefers saved ideas, then personal todo count, then invite", () => {
    assert.equal(resolvePlansLaunch({ ideaCount: 3, todoCount: 9 }).status, "3 saved ideas");
    assert.equal(resolvePlansLaunch({ ideaCount: 0, todoCount: 2 }).status, "2 on your list");
    const empty = resolvePlansLaunch({ ideaCount: 0, todoCount: 0 });
    assert.match(empty.status, /personal planning/i);
    assert.equal(empty.destination, "todos");
    assert.equal(empty.cta, "Continue Plans");
    assert.equal(empty.tone, "invite");
  });
});

describe("resolveStoryLaunch", () => {
  it("invites empty story and quietly confirms when written", () => {
    assert.equal(resolveStoryLaunch({ ourStory: null }).status, "Start your story");
    assert.equal(resolveStoryLaunch({ ourStory: "  " }).tone, "invite");
    const written = resolveStoryLaunch({ ourStory: "Once upon a time" });
    assert.equal(written.status, "Written ✓");
    assert.equal(written.cta, "Open Our Story");
    assert.equal(written.tone, "complete");
  });
});
