import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  capabilityRequiredByTask,
  filterTasksForVenueCapabilities,
  isPortalSectionEnabledByCapabilities,
  shouldHideIncompleteTaskForCapabilities,
  type VenuePlanningCapabilities,
} from "@/lib/playbooks/capabilities";
import {
  STANDARD_CLIENT_PLANNING_TASKS,
  STANDARD_VENUE_WORKFLOW_TASKS,
} from "@/lib/playbooks/constants";
import { buildEventReadiness } from "@/lib/readiness/compute";
import {
  buildUnifiedTaskList,
  groupUnifiedTasksByMilestone,
} from "@/lib/portal/unified-tasks";
import type { PortalTask } from "@/lib/portal/types";

const ALL_ON: VenuePlanningCapabilities = {
  timeline: true,
  floorPlan: true,
  seating: true,
  vendors: true,
};

const ALL_OFF: VenuePlanningCapabilities = {
  timeline: false,
  floorPlan: false,
  seating: false,
  vendors: false,
};

describe("PLAN-02/03 planning capabilities", () => {
  it("maps starter capability tasks via triggers", () => {
    assert.equal(
      capabilityRequiredByTask({ autoCompleteTrigger: "vendor_selected", actionType: null }),
      "vendors",
    );
    assert.equal(
      capabilityRequiredByTask({ autoCompleteTrigger: "seating_submitted", actionType: null }),
      "seating",
    );
    assert.equal(
      capabilityRequiredByTask({ autoCompleteTrigger: "timeline_submitted", actionType: null }),
      "timeline",
    );
    assert.equal(
      capabilityRequiredByTask({ autoCompleteTrigger: "floor_plan_created", actionType: null }),
      "floor_plan",
    );
    assert.equal(
      capabilityRequiredByTask({ autoCompleteTrigger: "timeline_created", actionType: null }),
      "timeline",
    );
  });

  it("filters starter tasks when capabilities are disabled (does not make remaining tasks optional)", () => {
    const clientFiltered = filterTasksForVenueCapabilities(
      STANDARD_CLIENT_PLANNING_TASKS.map((t) => ({
        autoCompleteTrigger: t.autoCompleteTrigger,
        actionType: t.actionType,
        title: t.title,
        isRequired: t.isRequired,
      })),
      ALL_OFF,
    );
    assert.ok(!clientFiltered.some((t) => /vendor|seating|timeline/i.test(t.title)));
    const seatingRequired = STANDARD_CLIENT_PLANNING_TASKS.find((t) =>
      t.autoCompleteTrigger === "seating_submitted",
    );
    assert.equal(seatingRequired?.isRequired, true);
    const guestCount = clientFiltered.find((t) => t.title.includes("guest count"));
    assert.equal(guestCount?.isRequired, true);

    const venueFiltered = filterTasksForVenueCapabilities(
      STANDARD_VENUE_WORKFLOW_TASKS.map((t) => ({
        autoCompleteTrigger: t.autoCompleteTrigger,
        actionType: t.actionType,
        title: t.title,
        isRequired: t.isRequired,
      })),
      { ...ALL_ON, floorPlan: false, timeline: false },
    );
    assert.ok(!venueFiltered.some((t) => /floor plan|timeline/i.test(t.title)));
    assert.ok(venueFiltered.some((t) => t.title === "Send contract" && t.isRequired));
  });

  it("hides incomplete couple tasks for disabled capabilities but keeps completed", () => {
    assert.equal(
      shouldHideIncompleteTaskForCapabilities(
        { autoCompleteTrigger: "seating_submitted", actionType: null, status: "pending" },
        { ...ALL_ON, seating: false },
      ),
      true,
    );
    assert.equal(
      shouldHideIncompleteTaskForCapabilities(
        { autoCompleteTrigger: "seating_submitted", actionType: null, status: "complete" },
        { ...ALL_ON, seating: false },
      ),
      false,
    );
  });

  it("gates portal sections by capability", () => {
    assert.equal(isPortalSectionEnabledByCapabilities("timeline", ALL_OFF), false);
    assert.equal(isPortalSectionEnabledByCapabilities("floor_plans", ALL_OFF), false);
    assert.equal(isPortalSectionEnabledByCapabilities("seating", ALL_OFF), false);
    assert.equal(isPortalSectionEnabledByCapabilities("vendors", ALL_OFF), false);
    assert.equal(isPortalSectionEnabledByCapabilities("tasks", ALL_OFF), true);
  });

  it("omits disabled capabilities from Event Readiness sections", () => {
    const summary = buildEventReadiness({
      eventId: "e1",
      readinessByKind: { client: null, venue: null },
      timelineEntries: [],
      guestSummary: {
        total: 0,
        attending: 0,
        declined: 0,
        pending: 0,
        invitationsSent: 0,
        invitationsResponded: 0,
        invitationsOutstanding: 0,
      },
      seatingSummary: null,
      floorPlans: [],
      inventoryUsage: [],
      requests: [],
      contracts: [],
      invoices: [],
      documents: [],
      conversationMessages: [],
      planningCapabilities: ALL_OFF,
    });
    const keys = summary.sections.map((s) => s.key);
    assert.ok(!keys.includes("timeline"));
    assert.ok(!keys.includes("seating"));
    assert.ok(!keys.includes("floorplans"));
    assert.ok(keys.includes("planning") || keys.includes("guests") || keys.length >= 1);
  });
});

function portalTask(partial: Partial<PortalTask> & Pick<PortalTask, "id" | "title">): PortalTask {
  return {
    description: null,
    category: "planning",
    ownerType: "couple",
    visibility: "client_owned",
    dueDate: "2026-10-01",
    daysOffset: -30,
    milestoneName: "",
    milestoneKind: null,
    status: "pending",
    isRequired: true,
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

describe("PLAN-04 couple Tasks milestone grouping", () => {
  it("groups venue_task rows by snapshotted milestoneName", () => {
    const list = buildUnifiedTaskList({
      venueTasks: [
        portalTask({ id: "1", title: "Sign contract", milestoneName: "Booking", dueDate: "2026-06-01" }),
        portalTask({ id: "2", title: "Guest count", milestoneName: "Final Details", dueDate: "2026-09-01" }),
        portalTask({ id: "3", title: "Questionnaire", milestoneName: "Planning", dueDate: "2026-07-01" }),
      ],
      requests: [],
      paymentSchedules: [],
      questionnaire: null,
      documents: [],
      timelineHasUnpublishedChanges: false,
    });
    const groups = groupUnifiedTasksByMilestone(list.filter((i) => !i.completed));
    assert.deepEqual(
      groups.map((g) => g.milestoneName),
      ["Booking", "Planning", "Final Details"],
    );
    assert.equal(groups[0]!.items[0]!.title, "Sign contract");
    assert.equal(groups[1]!.items[0]!.title, "Questionnaire");
  });

  it("omits incomplete seating/timeline/vendor tasks when capabilities are off", () => {
    const list = buildUnifiedTaskList({
      venueTasks: [
        portalTask({
          id: "1",
          title: "Submit seating",
          milestoneName: "Final Details",
          autoCompleteTrigger: "seating_submitted",
          canComplete: false,
        }),
        portalTask({
          id: "2",
          title: "Guest count",
          milestoneName: "Final Details",
          autoCompleteTrigger: "guest_count_finalized",
          canComplete: false,
        }),
      ],
      requests: [],
      paymentSchedules: [],
      questionnaire: null,
      documents: [],
      timelineHasUnpublishedChanges: true,
      planningCapabilities: { ...ALL_ON, seating: false, timeline: false },
    });
    assert.ok(!list.some((i) => i.title.includes("seating")));
    assert.ok(!list.some((i) => i.kind === "timeline"));
    assert.ok(list.some((i) => i.title.includes("Guest count")));
  });
});

describe("PLAN-01 / PLAN-05 / PLAN-07 seams", () => {
  it("unapply exists and blocks released client planning", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const repo = readFileSync(resolve("lib/playbooks/repository.ts"), "utf8");
    assert.match(repo, /export async function unapplyPlaybookFromEvent/);
    assert.match(repo, /already_released/);
    const ui = readFileSync(resolve("components/playbooks/event-task-list.tsx"), "utf8");
    assert.match(ui, /Remove Planning \/ Start Over/);
    assert.match(ui, /TASK_VISIBILITY\.find/);
    assert.match(ui, /Released Client Planning can/);
  });

  it("user-facing apply preview uses Milestone not sections", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const sheet = readFileSync(resolve("components/playbooks/playbook-apply-preview-sheet.tsx"), "utf8");
    assert.match(sheet, /milestone\{groups\.length === 1 \? "" : "s"\}/);
    assert.doesNotMatch(sheet, /section\{groups\.length/);
    const preview = readFileSync(resolve("app/(app)/library/playbooks/[id]/preview/page.tsx"), "utf8");
    assert.match(preview, /milestone\{groups\.length === 1 \? "" : "s"\}/);
    assert.doesNotMatch(preview, /section\{groups\.length/);
  });
});
