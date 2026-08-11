import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatPortalHash,
  parsePortalHash,
  portalFocusElementId,
} from "@/lib/portal/workspace-routing";
import { compactNextStepsActionLabel, fromUnifiedTask } from "@/lib/portal/next-steps";
import { buildUnifiedTaskList, venueTaskPresentation } from "@/lib/portal/unified-tasks";
import type { PortalTask } from "@/lib/portal/types";

function task(partial: Partial<PortalTask> & Pick<PortalTask, "id" | "title" | "status" | "dueDate">): PortalTask {
  return {
    description: null,
    category: "planning",
    ownerType: "venue",
    visibility: "client_owned",
    daysOffset: 0,
    milestoneName: "",
    milestoneKind: null,
    isRequired: true,
    completedAt: null,
    autoCompleteTrigger: null,
    canComplete: false,
    ...partial,
    canUndo: partial.canUndo ?? false,
    links: partial.links ?? [],
  };
}

describe("portal workspace hash routing", () => {
  it("parses section and focus from compound hash", () => {
    assert.deepEqual(parsePortalHash("#guests/finalize"), {
      section: "guests",
      focus: "finalize",
    });
    assert.deepEqual(parsePortalHash("vendors/pick"), {
      section: "vendors",
      focus: "pick",
    });
    assert.deepEqual(parsePortalHash("#payments"), {
      section: "payments",
      focus: null,
    });
  });

  it("rejects unknown section or focus without inventing routes", () => {
    assert.deepEqual(parsePortalHash("#not-a-section/finalize"), {
      section: null,
      focus: "finalize",
    });
    assert.deepEqual(parsePortalHash("#guests/not-a-focus"), {
      section: "guests",
      focus: null,
    });
  });

  it("accepts floor_plans as a deep-link section (Your Wedding → Floor Plan)", () => {
    assert.deepEqual(parsePortalHash("#floor_plans"), {
      section: "floor_plans",
      focus: null,
    });
    assert.equal(formatPortalHash("floor_plans"), "floor_plans");
  });

  it("formats deterministic hashes for domain targets including insurance upload", () => {
    assert.equal(formatPortalHash("guests", "finalize"), "guests/finalize");
    assert.equal(formatPortalHash("vendors", "pick"), "vendors/pick");
    assert.equal(formatPortalHash("seating", "submit"), "seating/submit");
    assert.equal(formatPortalHash("timeline", "submit"), "timeline/submit");
    assert.equal(formatPortalHash("timeline", "share"), "timeline/share");
    assert.equal(formatPortalHash("documents", "sign"), "documents/sign");
    assert.equal(formatPortalHash("documents", "upload"), "documents/upload");
    assert.equal(formatPortalHash("questionnaire", "form"), "questionnaire/form");
    assert.equal(formatPortalHash("payments", null), "payments");
    assert.deepEqual(parsePortalHash("#timeline/share"), {
      section: "timeline",
      focus: "share",
    });
    assert.equal(portalFocusElementId("timeline", "share"), "portal-focus-timeline-share");
  });

  it("builds section-scoped element ids", () => {
    assert.equal(portalFocusElementId("guests", "finalize"), "portal-focus-guests-finalize");
    assert.equal(portalFocusElementId("seating", "submit"), "portal-focus-seating-submit");
    assert.equal(portalFocusElementId("timeline", "submit"), "portal-focus-timeline-submit");
    assert.equal(portalFocusElementId("documents", "upload"), "portal-focus-documents-upload");
  });
});
describe("workspace routing + completion safety", () => {
  const due = "2026-09-01";
  const empty = {
    venueTasks: [] as PortalTask[],
    requests: [],
    paymentSchedules: [],
    questionnaire: null as { status: string } | null,
    documents: [] as { id: string; docType: string; name: string; status: string | null; signToken?: string | null }[],
    timelineHasUnpublishedChanges: false,
  };

  it("domain CTAs are navigate-only (completableHere false) with exact focus", () => {
    const list = buildUnifiedTaskList({
      ...empty,
      venueTasks: [
        task({ id: "1", title: "Submit your guest count", status: "pending", dueDate: due, autoCompleteTrigger: "guest_count_finalized" }),
        task({ id: "2", title: "Choose your vendors", status: "pending", dueDate: due, autoCompleteTrigger: "vendor_selected" }),
        task({ id: "3", title: "Submit seating", status: "pending", dueDate: due, autoCompleteTrigger: "seating_submitted" }),
        task({ id: "4", title: "Submit timeline", status: "pending", dueDate: due, autoCompleteTrigger: "timeline_submitted" }),
        task({ id: "5", title: "Sign contract", status: "pending", dueDate: due, autoCompleteTrigger: "contract_signed" }),
        task({ id: "6", title: "Questionnaire", status: "pending", dueDate: due, autoCompleteTrigger: "questionnaire_submitted" }),
        task({ id: "7", title: "Purchase event insurance", status: "pending", dueDate: due, autoCompleteTrigger: "document_uploaded_insurance" }),
      ],
    });
    for (const row of list) {
      assert.equal(row.completableHere, false, row.id);
      assert.ok(row.targetFocus, row.id);
    }
    assert.equal(list.find((t) => t.id === "task_7")?.targetFocus, "upload");
  });

  it("Home compact label stays Review while preserving underlying focus routing", () => {
    const unified = buildUnifiedTaskList({
      ...empty,
      venueTasks: [
        task({
          id: "gc",
          title: "Submit your guest count",
          status: "pending",
          dueDate: due,
          autoCompleteTrigger: "guest_count_finalized",
        }),
      ],
    })[0]!;
    const next = fromUnifiedTask(unified);
    assert.equal(compactNextStepsActionLabel(next), "Submit");
    assert.equal(next.targetSection, "guests");
    assert.equal(next.targetFocus, "finalize");
    // Review mapping still applies for Mark complete / Complete form paths
    assert.equal(
      compactNextStepsActionLabel({ actionLabel: "Mark complete", kind: "venue_task" }),
      "Review",
    );
  });

  it("manual Mark complete remains only for null-trigger acknowledgment", () => {
    const p = venueTaskPresentation(task({
      id: "leave",
      title: "Leave a review",
      status: "pending",
      dueDate: due,
      canComplete: true,
      autoCompleteTrigger: null,
    }));
    assert.equal(p.completableHere, true);
    assert.equal(p.targetFocus, null);
  });
});
