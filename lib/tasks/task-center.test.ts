import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeTaskCenterUrgency,
  isCoupleOwned,
  isDoOwned,
  laneForTask,
  matchEventsForFind,
  qualifiesForWatch,
  UPCOMING_DO_PREVIEW,
} from "@/lib/tasks/task-center";

const TODAY = "2026-09-05";
const WEEK = "2026-09-12";

function base(over: Partial<{
  ownerType: string;
  status: string;
  dueDate: string;
  isRequired: boolean;
  autoCompleteTrigger: string | null;
  clientPlanningReleased: boolean;
}> = {}) {
  return {
    ownerType: "couple",
    status: "pending",
    dueDate: "2026-09-10",
    isRequired: true,
    autoCompleteTrigger: null as string | null,
    clientPlanningReleased: true,
    ...over,
  };
}

describe("ownership", () => {
  it("treats couple as client-owned, not DO", () => {
    assert.equal(isCoupleOwned("couple"), true);
    assert.equal(isDoOwned("couple"), false);
  });

  it("treats coordinator, team, and vendor as DO", () => {
    for (const o of ["coordinator", "team", "vendor"]) {
      assert.equal(isDoOwned(o), true);
      assert.equal(isCoupleOwned(o), false);
      assert.equal(laneForTask(base({ ownerType: o }), TODAY, WEEK), "do");
    }
  });
});

describe("WATCH surfacing", () => {
  it("surfaces overdue client tasks", () => {
    assert.equal(
      qualifiesForWatch(base({ dueDate: "2026-08-01", status: "pending" }), TODAY, WEEK),
      true,
    );
    assert.equal(laneForTask(base({ dueDate: "2026-08-01" }), TODAY, WEEK), "watch");
  });

  it("surfaces blocked client tasks", () => {
    assert.equal(
      qualifiesForWatch(base({ status: "blocked", dueDate: "2027-01-01" }), TODAY, WEEK),
      true,
    );
  });

  it("surfaces due-soon client tasks", () => {
    assert.equal(qualifiesForWatch(base({ dueDate: "2026-09-10" }), TODAY, WEEK), true);
    assert.equal(qualifiesForWatch(base({ dueDate: TODAY }), TODAY, WEEK), true);
  });

  it("excludes unreleased Client Planning", () => {
    assert.equal(
      qualifiesForWatch(base({ clientPlanningReleased: false, dueDate: "2026-08-01" }), TODAY, WEEK),
      false,
    );
    assert.equal(
      laneForTask(base({ clientPlanningReleased: false, dueDate: "2026-08-01" }), TODAY, WEEK),
      "neither",
    );
  });

  it("excludes far-future optional client checklist items", () => {
    assert.equal(
      qualifiesForWatch(
        base({
          dueDate: "2028-08-26",
          isRequired: false,
          autoCompleteTrigger: null,
        }),
        TODAY,
        WEEK,
      ),
      false,
    );
  });

  it("excludes far-future required client tasks until they enter the window", () => {
    assert.equal(
      qualifiesForWatch(
        base({
          dueDate: "2028-04-14",
          isRequired: true,
          autoCompleteTrigger: "contract_signed",
        }),
        TODAY,
        WEEK,
      ),
      false,
    );
  });

  it("never puts couple tasks in DO", () => {
    assert.notEqual(laneForTask(base({ dueDate: "2026-08-01" }), TODAY, WEEK), "do");
  });
});

describe("urgency buckets", () => {
  it("classifies overdue, today, soon, upcoming", () => {
    assert.equal(computeTaskCenterUrgency("pending", "2026-08-01", TODAY, WEEK), "overdue");
    assert.equal(computeTaskCenterUrgency("blocked", "2026-08-01", TODAY, WEEK), "blocked");
    assert.equal(computeTaskCenterUrgency("pending", TODAY, TODAY, WEEK), "due_today");
    assert.equal(computeTaskCenterUrgency("pending", "2026-09-10", TODAY, WEEK), "due_soon");
    assert.equal(computeTaskCenterUrgency("pending", "2027-01-01", TODAY, WEEK), "upcoming");
  });
});

describe("Find", () => {
  const events = [
    { id: "1", name: "Sara Parker & Peter Parker — wedding", eventDate: "2028-08-12", coupleLabel: "Sara & Peter" },
    { id: "2", name: "Emily Carter & James Cavendish — Wedding", eventDate: "2027-08-09", coupleLabel: "Emily & James" },
  ];

  it("matches couple and event name", () => {
    assert.equal(matchEventsForFind(events, "parker").length, 1);
    assert.equal(matchEventsForFind(events, "cavendish").length, 1);
    assert.equal(matchEventsForFind(events, "wedding").length, 2);
  });

  it("returns empty for no match", () => {
    assert.deepEqual(matchEventsForFind(events, "zzz-nope"), []);
  });

  it("ignores blank query", () => {
    assert.deepEqual(matchEventsForFind(events, "  "), []);
  });
});

describe("Upcoming preview constant", () => {
  it("keeps Upcoming concise", () => {
    assert.ok(UPCOMING_DO_PREVIEW > 0 && UPCOMING_DO_PREVIEW <= 24);
  });
});
