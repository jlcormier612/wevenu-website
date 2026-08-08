import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compactNextStepsActionLabel,
  formatNextStepsDueLabel,
  groupNextStepsForDisplay,
  selectNextStepsForHome,
  sortNextStepsWithinGroup,
  type NextStepsItem,
} from "@/lib/portal/next-steps";
import { buildUnifiedTaskList } from "@/lib/portal/unified-tasks";
import type { PortalTask } from "@/lib/portal/types";

function item(partial: Partial<NextStepsItem> & Pick<NextStepsItem, "id" | "title" | "ownership">): NextStepsItem {
  return {
    description: null,
    dueDate: null,
    isOverdue: false,
    isRequired: false,
    targetSection: "tasks",
    actionLabel: "View",
    ...partial,
  };
}

function task(partial: Partial<PortalTask> & Pick<PortalTask, "id" | "title" | "status" | "dueDate">): PortalTask {
  return {
    description: null,
    category: "planning",
    ownerType: "venue",
    visibility: "client_visible",
    daysOffset: 0,
    milestoneName: "",
    milestoneKind: null,
    isRequired: false,
    completedAt: null,
    canComplete: true,
    ...partial,
  };
}

const TODAY = "2026-08-08";

describe("Next Steps Home presentation", () => {
  it("orders within a group: overdue → today → tomorrow → soonest → undated", () => {
    const nextWeek = "2026-08-15";
    const tomorrow = "2026-08-09";
    const yesterday = "2026-08-07";

    const sorted = sortNextStepsWithinGroup(
      [
        item({ id: "undated", title: "Undated", ownership: "venue", dueDate: null }),
        item({ id: "soon", title: "Soon", ownership: "venue", dueDate: nextWeek }),
        item({ id: "tom", title: "Tomorrow", ownership: "venue", dueDate: tomorrow }),
        item({ id: "today", title: "Today", ownership: "venue", dueDate: TODAY }),
        item({ id: "late", title: "Late", ownership: "venue", dueDate: yesterday, isOverdue: true }),
      ],
      TODAY,
    );

    assert.deepEqual(sorted.map((i) => i.id), ["late", "today", "tom", "soon", "undated"]);
  });

  it("fills the cap with venue (P1) before shared (P2)", () => {
    const venue = Array.from({ length: 4 }, (_, i) =>
      item({
        id: `v${i}`,
        title: `Venue ${i}`,
        ownership: "venue",
        dueDate: `2026-08-${10 + i}`,
      }),
    );
    const shared = [
      item({ id: "pay1", title: "First Installment", ownership: "shared", dueDate: "2026-08-01", isOverdue: true, kind: "payment", actionLabel: "Pay now", targetSection: "payments" }),
      item({ id: "pay2", title: "Second Installment", ownership: "shared", dueDate: "2026-08-20", kind: "payment", actionLabel: "Pay now", targetSection: "payments" }),
    ];

    const { visible, total, hasMore } = selectNextStepsForHome([...shared, ...venue], 5, TODAY);
    assert.equal(total, 6);
    assert.equal(hasMore, true);
    assert.equal(visible.length, 5);
    assert.deepEqual(visible.map((i) => i.ownership), ["venue", "venue", "venue", "venue", "shared"]);
    assert.equal(visible[4]?.id, "pay1"); // highest-priority shared fills remaining slot
  });

  it("does not force one of every category when only shared remains", () => {
    const shared = [
      item({ id: "a", title: "A", ownership: "shared", dueDate: "2026-08-01", isOverdue: true }),
      item({ id: "b", title: "B", ownership: "shared", dueDate: TODAY }),
      item({ id: "c", title: "C", ownership: "shared", dueDate: null }),
    ];
    const { visible, hasMore } = selectNextStepsForHome(shared, 5, TODAY);
    assert.equal(hasMore, false);
    assert.deepEqual(visible.map((i) => i.id), ["a", "b", "c"]);
  });

  it("groups visible rows as From your venue then Shared planning", () => {
    const { venue, shared } = groupNextStepsForDisplay([
      item({ id: "v", title: "V", ownership: "venue" }),
      item({ id: "s", title: "S", ownership: "shared" }),
    ]);
    assert.equal(venue.length, 1);
    assert.equal(shared.length, 1);
    assert.equal(venue[0]?.id, "v");
    assert.equal(shared[0]?.id, "s");
  });

  it("formats due labels without shame language", () => {
    assert.equal(formatNextStepsDueLabel(TODAY, false, TODAY), "Due today");
    assert.equal(formatNextStepsDueLabel("2026-08-09", false, TODAY), "Due tomorrow");
    assert.equal(formatNextStepsDueLabel("2026-08-18", false, TODAY), "Due Aug 18");
    assert.equal(formatNextStepsDueLabel("2026-08-01", true, TODAY), "Overdue — needed by Aug 1");
    assert.equal(formatNextStepsDueLabel(null, false, TODAY), null);
  });

  it("compacts CTAs to Review/Submit/Upload/Approve/Pay/Complete", () => {
    assert.equal(compactNextStepsActionLabel({ actionLabel: "Pay now", kind: "payment" }), "Pay");
    assert.equal(compactNextStepsActionLabel({ actionLabel: "Review & submit", kind: "timeline" }), "Submit");
    assert.equal(compactNextStepsActionLabel({ actionLabel: "Upload", kind: "request" }), "Upload");
    assert.equal(compactNextStepsActionLabel({ actionLabel: "Approve proposal", kind: "request" }), "Approve");
    assert.equal(compactNextStepsActionLabel({ actionLabel: "Mark complete", kind: "venue_task" }), "Complete");
    assert.equal(compactNextStepsActionLabel({ actionLabel: "Review & sign", kind: "contract" }), "Review");
  });

  it("never includes personal todos from unified synthesis", () => {
    const list = buildUnifiedTaskList({
      venueTasks: [task({ id: "v1", title: "Venue need", status: "pending", dueDate: TODAY })],
      requests: [],
      paymentSchedules: [],
      questionnaire: null,
      documents: [],
      timelineHasUnpublishedChanges: false,
    });
    // Couple todos are a separate Plans SoT — they never enter buildUnifiedTaskList.
    assert.ok(list.every((t) => t.ownership === "venue" || t.ownership === "shared"));
    assert.ok(!list.some((t) => t.title.toLowerCase().includes("personal")));
  });

  it("does not fill Home cap slots with completed items", () => {
    const list = buildUnifiedTaskList({
      venueTasks: [
        task({ id: "done", title: "Done", status: "complete", dueDate: TODAY }),
        task({ id: "open", title: "Open", status: "pending", dueDate: "2026-08-12" }),
      ],
      requests: [],
      paymentSchedules: [],
      questionnaire: null,
      documents: [],
      timelineHasUnpublishedChanges: false,
    }).filter((t) => !t.completed);

    const { visible, total } = selectNextStepsForHome(
      list.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        isOverdue: t.isOverdue,
        isRequired: t.isRequired,
        ownership: t.ownership,
        targetSection: t.targetSection,
        actionLabel: t.actionLabel,
        kind: t.kind,
      })),
      5,
      TODAY,
    );
    assert.equal(total, 1);
    assert.equal(visible[0]?.id, "task_open");
  });
});
