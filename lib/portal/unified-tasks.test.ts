import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUnifiedTaskList, ownershipLabel } from "@/lib/portal/unified-tasks";
import type { PortalTask } from "@/lib/portal/types";

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

describe("buildUnifiedTaskList attention ordering", () => {
  it("boosts overdue before earlier-but-not-overdue due dates", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yIso = yesterday.toISOString().slice(0, 10);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nIso = nextWeek.toISOString().slice(0, 10);

    const list = buildUnifiedTaskList({
      venueTasks: [
        task({ id: "soon", title: "Soon", status: "pending", dueDate: nIso }),
        task({ id: "late", title: "Late", status: "overdue", dueDate: yIso }),
        task({ id: "undated-q", title: "Undated peer", status: "pending", dueDate: "" }),
      ],
      requests: [],
      paymentSchedules: [],
      questionnaire: { status: "sent" },
      documents: [],
      timelineHasUnpublishedChanges: false,
    }).filter((t) => !t.completed);

    assert.equal(list[0]?.id, "task_late");
    assert.equal(list[0]?.isOverdue, true);
    assert.equal(list[1]?.id, "task_soon");
    assert.equal(list.at(-1)?.kind, "questionnaire");
    assert.equal(ownershipLabel(list[0]!.ownership), "From your venue");
  });

  it("marks unpaid past-due payments as shared overdue", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const yIso = yesterday.toISOString().slice(0, 10);

    const list = buildUnifiedTaskList({
      venueTasks: [],
      requests: [],
      paymentSchedules: [{
        title: "Schedule",
        lineItems: [{ id: "p1", label: "Deposit", amount: 1000, dueDate: yIso, status: "pending" }],
      }],
      questionnaire: null,
      documents: [],
      timelineHasUnpublishedChanges: false,
    });

    assert.equal(list[0]?.kind, "payment");
    assert.equal(list[0]?.isOverdue, true);
    assert.equal(list[0]?.ownership, "shared");
    assert.equal(ownershipLabel("shared"), "Shared planning");
  });
});
