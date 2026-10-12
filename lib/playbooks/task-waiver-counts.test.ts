import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { formatRequiredTaskProgress } from "@/lib/playbooks/constants";
import type { EventReadiness, EventTask } from "@/lib/playbooks/types";
import { computePlanningReadiness } from "@/lib/readiness/compute";

function task(overrides: Partial<EventTask> & Pick<EventTask, "id" | "status" | "ownerType">): EventTask {
  return {
    venueId: "v1",
    eventId: "e1",
    templateTaskId: null,
    title: overrides.id,
    description: null,
    visibility: "client_visible",
    dueDate: "2027-09-01",
    daysOffset: 0,
    dueDateRuleKind: "relative_to_event",
    dueDateLocked: false,
    category: "planning",
    milestoneName: "Prep",
    milestoneKind: null,
    autoCompleteTrigger: null,
    paymentLineItemId: null,
    isRequired: true,
    dependsOnEventTaskId: null,
    dependsOnTitle: null,
    completedAt: null,
    completedBy: null,
    notes: null,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    reminderBeforeDays: null,
    escalationAfterDays: null,
    notifyOnAssign: false,
    notifyOnComplete: false,
    assignedToStaffId: null,
    assignedToName: null,
    actionType: null,
    actionLabel: null,
    requestId: null,
    scheduledDate: null,
    scheduledStartTime: null,
    scheduledEndTime: null,
    location: null,
    ...overrides,
  };
}

/** Mirror readinessFromTasks counting rules (completed ≠ waived). */
function readinessFromTasks(tasks: EventTask[]): EventReadiness {
  const required = tasks.filter((t) => t.isRequired);
  const optional = tasks.filter((t) => !t.isRequired);
  const completedRequired = required.filter((t) => t.status === "complete").length;
  const waivedRequired = required.filter((t) => t.status === "waived").length;
  const satisfied = completedRequired + waivedRequired;
  return {
    score: required.length > 0 ? Math.round((satisfied / required.length) * 100) : 0,
    completedRequired,
    waivedRequired,
    totalRequired: required.length,
    completedOptional: optional.filter((t) => t.status === "complete").length,
    totalOptional: optional.length,
    tasks,
    blockedCount: tasks.filter((t) => t.status === "blocked").length,
    overdueCount: tasks.filter((t) => t.status === "overdue").length,
  };
}

describe("task waiver vs completion counts", () => {
  it("reconciles top-level and detailed counts from the same task set", () => {
    const tasks = [
      task({ id: "c1", status: "complete", ownerType: "couple" }),
      task({ id: "w1", status: "waived", ownerType: "couple" }),
      task({ id: "p1", status: "pending", ownerType: "couple" }),
      task({ id: "v1", status: "pending", ownerType: "coordinator" }),
      task({ id: "v2", status: "complete", ownerType: "coordinator" }),
    ];
    const client = readinessFromTasks(tasks.filter((t) => t.ownerType === "couple"));
    const venue = readinessFromTasks(tasks.filter((t) => t.ownerType !== "couple"));
    assert.equal(client.completedRequired, 1);
    assert.equal(client.waivedRequired, 1);
    assert.equal(client.totalRequired, 3);
    assert.equal(venue.completedRequired, 1);
    assert.equal(venue.waivedRequired, 0);
    assert.equal(venue.totalRequired, 2);

    const open = tasks.filter((t) => t.status !== "complete" && t.status !== "waived").length;
    const complete = tasks.filter((t) => t.status === "complete").length;
    const waived = tasks.filter((t) => t.status === "waived").length;
    assert.equal(open + complete + waived, tasks.length);
    assert.equal(client.totalRequired + venue.totalRequired, tasks.length);
  });

  it("keeps client and venue checklist counts separate", () => {
    const clientTasks = [
      task({ id: "c1", status: "complete", ownerType: "couple" }),
      task({ id: "c2", status: "pending", ownerType: "couple" }),
    ];
    const venueTasks = [
      task({ id: "v1", status: "waived", ownerType: "coordinator" }),
    ];
    const client = readinessFromTasks(clientTasks);
    const venue = readinessFromTasks(venueTasks);
    assert.equal(client.completedRequired, 1);
    assert.equal(client.waivedRequired, 0);
    assert.equal(venue.completedRequired, 0);
    assert.equal(venue.waivedRequired, 1);
    assert.notEqual(client.totalRequired, venue.totalRequired);
  });

  it("never counts waived as completed in progress copy", () => {
    const readiness = readinessFromTasks([
      task({ id: "c1", status: "complete", ownerType: "couple" }),
      task({ id: "w1", status: "waived", ownerType: "couple" }),
      task({ id: "p1", status: "pending", ownerType: "couple" }),
    ]);
    assert.equal(readiness.completedRequired, 1);
    assert.equal(readiness.waivedRequired, 1);
    assert.equal(readiness.score, 67);
    const line = formatRequiredTaskProgress(readiness);
    assert.match(line, /1 completed/);
    assert.match(line, /1 waived/);
    assert.doesNotMatch(line, /2 of 3 required completed/);
  });

  it("planning readiness detail distinguishes waived from completed", () => {
    const section = computePlanningReadiness({
      client: readinessFromTasks([
        task({ id: "c1", status: "complete", ownerType: "couple" }),
        task({ id: "w1", status: "waived", ownerType: "couple" }),
      ]),
      venue: null,
    });
    assert.match(section.detail, /1 completed · 1 waived of 2 required/);
    assert.equal(section.metric, "2/2");
    assert.equal(section.status, "complete");
  });

  it("persist path clears completion stamps when waiving", () => {
    const repo = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
    const fn = repo.slice(
      repo.indexOf("export async function updateEventTaskStatus"),
      repo.indexOf("/** Auto-complete tasks matching a trigger"),
    );
    assert.match(fn, /status === "waived"/);
    assert.match(fn, /patch\.completed_at = null/);
    assert.match(fn, /patch\.completed_by = null/);
    assert.doesNotMatch(fn, /status:\s*"complete"/);
  });

  it("task row UI keeps waived out of completed styling and complete action", () => {
    const ui = readFileSync(
      new URL("../../components/playbooks/event-task-list.tsx", import.meta.url),
      "utf8",
    );
    assert.match(ui, /const isWaived = task\.status === "waived"/);
    assert.match(ui, /isComplete \? "text-muted-foreground line-through"/);
    assert.match(ui, /\{isWaived && \(/);
    assert.match(ui, /renderGroup\(waived,\s*"Waived"/);
    assert.match(ui, /!isClosed &&/);
  });
});
