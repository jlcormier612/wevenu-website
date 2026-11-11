/**
 * Every playbook "Opens" actionType maps to a portal workspace section
 * (couple click) and a venue event tab hash (staff link).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TASK_ACTION_TYPES, taskActionHref, taskActionLabel } from "@/lib/playbooks/constants";
import type { TaskActionType } from "@/lib/playbooks/types";
import { venueTaskPresentation } from "@/lib/portal/unified-tasks";
import type { PortalTask } from "@/lib/portal/types";

function task(partial: Partial<PortalTask> & Pick<PortalTask, "id" | "title">): PortalTask {
  return {
    description: null,
    category: "planning",
    ownerType: "couple",
    visibility: "client_owned",
    daysOffset: -30,
    milestoneName: "Planning",
    milestoneKind: null,
    status: "pending",
    dueDate: "2026-12-01",
    isRequired: false,
    completedAt: null,
    autoCompleteTrigger: null,
    actionType: null,
    actionLabel: null,
    canComplete: true,
    canUndo: false,
    links: [],
    ...partial,
  };
}

const DROPDOWN: { label: string; value: TaskActionType | null }[] = [
  { label: "Nothing — just a checklist item", value: null },
  ...TASK_ACTION_TYPES.map((a) => ({ label: a.defaultLabel, value: a.value })),
];

describe("task Opens destinations — full matrix", () => {
  it("dropdown inventory matches TASK_ACTION_TYPES + none (13 options)", () => {
    assert.equal(DROPDOWN.length, 13);
    assert.equal(DROPDOWN.filter((d) => d.value === null).length, 1);
    assert.equal(TASK_ACTION_TYPES.length, 12);
  });

  it("custom button label never changes destination section", () => {
    for (const a of TASK_ACTION_TYPES) {
      const custom = `E2E Label ${a.value}`;
      const p = venueTaskPresentation(
        task({
          id: `t-${a.value}`,
          title: `Task ${a.value}`,
          actionType: a.value,
          actionLabel: custom,
        }),
      );
      const baseline = venueTaskPresentation(
        task({
          id: `t-${a.value}-b`,
          title: `Task ${a.value}`,
          actionType: a.value,
          actionLabel: null,
        }),
      );
      assert.equal(p.targetSection, baseline.targetSection, a.value);
      assert.equal(p.targetFocus, baseline.targetFocus, a.value);
      assert.equal(p.actionLabel, custom);
      assert.equal(baseline.actionLabel, a.defaultLabel);
      assert.notEqual(p.targetSection, "tasks", `${a.value} must navigate in-app`);
    }
  });

  it("checklist-only (null action) has no native Open destination", () => {
    const p = venueTaskPresentation(
      task({ id: "t-none", title: "Plain checklist", actionType: null, actionLabel: null }),
    );
    assert.equal(p.targetSection, "tasks");
    assert.equal(p.externalUrl, null);
  });

  it("venue staff href stays event-scoped for every action", () => {
    for (const a of TASK_ACTION_TYPES) {
      const href = taskActionHref(a.value, "evt-abc");
      assert.ok(href?.startsWith("/events/evt-abc#"), a.value);
      assert.equal(taskActionLabel(a.value, "Custom"), "Custom");
      assert.equal(taskActionLabel(a.value, null), a.defaultLabel);
    }
    assert.equal(taskActionHref(null, "evt-abc"), null);
  });

  it("Your Choices venue deep-link targets event-order-choices anchor", () => {
    assert.equal(
      taskActionHref("client_choices", "e1"),
      "/events/e1#event-order-choices",
    );
  });

  it("portal sections for each Opens value are distinct where product intends", () => {
    const eo = venueTaskPresentation(
      task({ id: "1", title: "EO", actionType: "event_order", actionLabel: null }),
    );
    const choices = venueTaskPresentation(
      task({ id: "2", title: "Choices", actionType: "client_choices", actionLabel: null }),
    );
    assert.equal(eo.targetSection, "event-order");
    assert.equal(choices.targetSection, "choices");
    assert.notEqual(eo.targetSection, choices.targetSection);
  });
});
