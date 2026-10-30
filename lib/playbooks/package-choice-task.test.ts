import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  applyAcceptedPackageToTasks,
  hasAcceptedPackage,
  isPackageChoiceTask,
} from "@/lib/playbooks/package-choice-task";
import { buildUnifiedTaskList } from "@/lib/portal/unified-tasks";
import type { PortalTask } from "@/lib/portal/types";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function portalTask(overrides: Partial<PortalTask>): PortalTask {
  return {
    id: "t1",
    title: "Choose your package",
    description: null,
    category: "planning",
    ownerType: "couple",
    visibility: "client_owned",
    dueDate: "2026-01-01",
    daysOffset: -115,
    milestoneName: "Booking",
    milestoneKind: null,
    status: "pending",
    isRequired: false,
    completedAt: null,
    autoCompleteTrigger: null,
    actionType: null,
    actionLabel: null,
    canComplete: true,
    canUndo: false,
    links: [],
    ...overrides,
  };
}

function unifiedRows(tasks: PortalTask[]) {
  return buildUnifiedTaskList({
    venueTasks: tasks,
    requests: [],
    paymentSchedules: [],
    questionnaire: null,
    documents: [],
    timelineHasUnpublishedChanges: false,
  });
}

describe("R3 — approved package never appears as an open choice", () => {
  it("recognizes the package task by title only", () => {
    assert.equal(isPackageChoiceTask({ title: "Choose your package" }), true);
    assert.equal(isPackageChoiceTask({ title: "  choose YOUR package " }), true);
    assert.equal(isPackageChoiceTask({ title: "Choose your vendors" }), false);
    assert.equal(isPackageChoiceTask({ title: "Leave a review" }), false);
  });

  it("original defect: with no derivation the couple sees an open manual package button", () => {
    const [row] = unifiedRows([portalTask({})]);
    assert.equal(row.completed, false);
    assert.equal(row.completableHere, true);
    assert.equal(row.actionLabel, "Mark complete");
    const [linked] = unifiedRows([portalTask({ links: [{ id: "l1", url: "https://example.com/pkg", label: null }] })]);
    assert.equal(linked.confirmLabel, "I've chosen my package");
  });

  it("accepted package: the package task is done with no button on the couple list", () => {
    const tasks = applyAcceptedPackageToTasks([portalTask({})], true);
    assert.equal(tasks[0].status, "complete");
    assert.equal(tasks[0].packageApproved, true);
    assert.equal(tasks[0].canComplete, false);
    assert.equal(tasks[0].canUndo, false);
    const [row] = unifiedRows(tasks);
    assert.equal(row.completed, true);
    assert.equal(row.completableHere, false);
    assert.equal(row.undoableHere, false);
    assert.equal(row.confirmLabel, null);
  });

  it("no accepted package: the task is unchanged", () => {
    const input = [portalTask({})];
    assert.equal(applyAcceptedPackageToTasks(input, false), input);
    const [row] = unifiedRows(applyAcceptedPackageToTasks(input, false));
    assert.equal(row.completed, false);
    assert.equal(row.completableHere, true);
  });

  it("other tasks are never touched, and a waived package task stays waived", () => {
    const review = portalTask({ id: "t2", title: "Leave a review" });
    const insurance = portalTask({ id: "t3", title: "Purchase event insurance", autoCompleteTrigger: "document_uploaded_insurance", canComplete: false });
    const [r, i] = applyAcceptedPackageToTasks([review, insurance], true);
    assert.equal(r, review);
    assert.equal(i, insurance);
    const waived = { title: "Choose your package", status: "waived" };
    assert.deepEqual(applyAcceptedPackageToTasks([waived], true)[0], waived);
  });

  it("hasAcceptedPackage queries only accepted selections for this venue and client", async () => {
    const filters: [string, unknown][] = [];
    let table = "";
    const chain = {
      select: () => chain,
      eq: (col: string, val: unknown) => { filters.push([col, val]); return chain; },
      limit: async () => ({ data: [{ id: "s1" }], error: null }),
    };
    const ok = await hasAcceptedPackage({ from: (t: string) => { table = t; return chain; } }, "v1", "c1");
    assert.equal(ok, true);
    assert.equal(table, "commercial_selections");
    assert.deepEqual(filters, [["venue_id", "v1"], ["client_id", "c1"], ["status", "accepted"]]);
  });

  it("couple portal tasks and venue Planning Tasks both apply the same rule", () => {
    const portal = read("lib/portal/service.ts");
    assert.match(portal, /applyAcceptedPackageToTasks\(tasks, accepted\)/);
    assert.match(portal, /hasAcceptedPackage\(admin, session\.venue_id, session\.client_id\)/);
    const service = read("lib/playbooks/service.ts");
    assert.match(service, /applyAcceptedPackageToTasks\(tasks, await eventPackageAccepted/);
    assert.match(service, /computeEventTaskReadinessByKind\(\s*supabase,\s*venue\.id,\s*eventId,\s*await eventPackageAccepted/);
  });

  it("derived completion is never persisted", () => {
    const helper = read("lib/playbooks/package-choice-task.ts");
    assert.doesNotMatch(helper, /\.update\(|\.insert\(|\.upsert\(|\.rpc\(/);
  });

  it("venue row labels the derived completion and offers no Reopen", () => {
    const list = read("components/playbooks/event-task-list.tsx");
    assert.match(list, /task\.packageApproved && \(/);
    assert.match(list, /isComplete && !task\.packageApproved && \(/);
  });

  it("migration removes the task from client templates only, never event tasks", () => {
    const sql = read("supabase/migrations/20261426400000_client_templates_drop_choose_your_package.sql");
    assert.match(sql, /delete from public\.playbook_tasks/);
    assert.match(sql, /t\.kind = 'client'/);
    assert.match(sql, /lower\(btrim\(pt\.title\)\) = 'choose your package'/);
    assert.doesNotMatch(sql, /delete from public\.event_tasks|update public\.event_tasks/);
  });
});
