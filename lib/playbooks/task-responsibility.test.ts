import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  groupTasksByResponsibility,
  responsibilityForOwnerType,
  responsibilityGroupsCoverAll,
  TASK_RESPONSIBILITY_LABEL,
} from "@/lib/playbooks/task-responsibility";

describe("task responsibility grouping", () => {
  it("maps ownerType metadata to Client / Venue / Vendor", () => {
    assert.equal(responsibilityForOwnerType("couple"), "client");
    assert.equal(responsibilityForOwnerType("coordinator"), "venue");
    assert.equal(responsibilityForOwnerType("team"), "venue");
    assert.equal(responsibilityForOwnerType("vendor"), "vendor");
  });

  it("treats unknown ownerType as venue (never client)", () => {
    assert.equal(responsibilityForOwnerType("mystery"), "venue");
    assert.equal(responsibilityForOwnerType(""), "venue");
  });

  it("groups mixed tasks without omission or duplication", () => {
    const tasks = [
      { id: "1", ownerType: "couple", title: "Complete your questionnaire" },
      { id: "2", ownerType: "coordinator", title: "Send contract" },
      { id: "3", ownerType: "vendor", title: "Confirm load-in" },
      { id: "4", ownerType: "team", title: "Prep ceremony chairs" },
      { id: "5", ownerType: "couple", title: "Submit guest count" },
    ];
    const groups = groupTasksByResponsibility(tasks);
    assert.deepEqual(groups.client.map((t) => t.id), ["1", "5"]);
    assert.deepEqual(groups.venue.map((t) => t.id), ["2", "4"]);
    assert.deepEqual(groups.vendor.map((t) => t.id), ["3"]);
    assert.equal(responsibilityGroupsCoverAll(tasks, groups), true);
    assert.equal(groups.client.length + groups.venue.length + groups.vendor.length, tasks.length);
  });

  it("dedupes by id if the same task appears twice in input", () => {
    const tasks = [
      { id: "1", ownerType: "couple" },
      { id: "1", ownerType: "couple" },
      { id: "2", ownerType: "vendor" },
    ];
    const groups = groupTasksByResponsibility(tasks);
    assert.equal(groups.client.length, 1);
    assert.equal(groups.vendor.length, 1);
    assert.equal(responsibilityGroupsCoverAll(tasks, groups), true);
  });

  it("section labels match product wording", () => {
    assert.equal(TASK_RESPONSIBILITY_LABEL.client, "Client");
    assert.equal(TASK_RESPONSIBILITY_LABEL.venue, "Venue");
    assert.equal(TASK_RESPONSIBILITY_LABEL.vendor, "Vendor");
  });
});

describe("EventTaskList responsibility UI seams", () => {
  const list = readFileSync(resolve("components/playbooks/event-task-list.tsx"), "utf8");
  const portalPlanning = readFileSync(resolve("components/portal/planning-tasks-view.tsx"), "utf8");
  const previewLoader = readFileSync(resolve("lib/client-portal-preview/load-preview.ts"), "utf8");

  it("renders three responsibility sections from groupTasksByResponsibility", () => {
    assert.match(list, /groupTasksByResponsibility/);
    assert.match(list, /data-testid=\{`planning-responsibility-\$\{key\}`\}/);
    assert.match(list, /renderResponsibilitySection\("client", clientTasks\)/);
    assert.match(list, /renderResponsibilitySection\("venue", venueTasks\)/);
    assert.match(list, /renderResponsibilitySection\("vendor", vendorTasks\)/);
  });

  it("does not use a single mixed overdue/upcoming list as the only grouping", () => {
    // Status subgroups remain inside each responsibility section.
    assert.match(list, /sectionOverdue/);
    assert.match(list, /sectionPending/);
    assert.doesNotMatch(
      list,
      /\{renderGroup\(overdue[\s\S]*renderGroup\(pending[\s\S]*renderGroup\(complete/,
    );
  });

  it("couple portal planning never loads venue owner_type tasks", () => {
    assert.match(previewLoader, /\.eq\("owner_type", "couple"\)/);
    assert.match(previewLoader, /client_visible/);
    assert.doesNotMatch(portalPlanning, /planning-responsibility-venue/);
  });
});
