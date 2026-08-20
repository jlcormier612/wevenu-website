import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPLY_PREVIEW_ISOLATION_NOTE,
  applyPreviewKindCopy,
  groupTasksForApplyPreview,
} from "@/lib/playbooks/apply-preview";
import type { PlaybookMilestone, PlaybookTask } from "@/lib/playbooks/types";

function milestone(partial: Partial<PlaybookMilestone> & Pick<PlaybookMilestone, "id" | "name" | "sortOrder">): PlaybookMilestone {
  return {
    templateId: "t1",
    venueId: "v1",
    kind: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...partial,
  };
}

function task(partial: Partial<PlaybookTask> & Pick<PlaybookTask, "id" | "title" | "milestoneId" | "sortOrder">): PlaybookTask {
  return {
    templateId: "t1",
    venueId: "v1",
    description: null,
    ownerType: "couple",
    visibility: "client_owned",
    daysOffset: -30,
    dueDateRuleKind: "relative_to_event",
    category: "planning",
    autoCompleteTrigger: null,
    dependsOnTaskId: null,
    isRequired: true,
    createdAt: "2026-01-01",
    reminderBeforeDays: null,
    escalationAfterDays: null,
    notifyOnAssign: false,
    notifyOnComplete: false,
    actionType: null,
    actionLabel: null,
    needsReview: false,
    ...partial,
  };
}

describe("apply preview helpers", () => {
  it("explains Client vs Venue checklists in product language", () => {
    const client = applyPreviewKindCopy("client");
    const venue = applyPreviewKindCopy("venue");
    assert.equal(client.label, "Client Checklist");
    assert.match(client.explanation, /couple/i);
    assert.match(client.explanation, /before sharing/i);
    assert.equal(venue.label, "Venue Checklist");
    assert.match(venue.explanation, /venue team/i);
    assert.match(venue.explanation, /as soon as you apply/i);
  });

  it("groups task titles under milestones in sort order", () => {
    const milestones = [
      milestone({ id: "m2", name: "Final stretch", sortOrder: 2 }),
      milestone({ id: "m1", name: "Getting started", sortOrder: 1 }),
    ];
    const tasks = [
      task({ id: "t2", title: "Confirm guest count", milestoneId: "m2", sortOrder: 1 }),
      task({ id: "t1", title: "Share inspiration", milestoneId: "m1", sortOrder: 1 }),
      task({ id: "t3", title: "Book hotel block", milestoneId: "m1", sortOrder: 2 }),
    ];
    const groups = groupTasksForApplyPreview(milestones, tasks);
    assert.deepEqual(
      groups.map((g) => ({ name: g.milestoneName, titles: g.taskTitles })),
      [
        { name: "Getting started", titles: ["Share inspiration", "Book hotel block"] },
        { name: "Final stretch", titles: ["Confirm guest count"] },
      ],
    );
  });

  it("places tasks with a missing milestone under Other", () => {
    const groups = groupTasksForApplyPreview(
      [milestone({ id: "m1", name: "Chapter one", sortOrder: 1 })],
      [
        task({ id: "t1", title: "Known chapter task", milestoneId: "m1", sortOrder: 1 }),
        task({ id: "t2", title: "Orphan task", milestoneId: "gone", sortOrder: 2 }),
      ],
    );
    assert.equal(groups.length, 2);
    assert.equal(groups[1]?.milestoneName, "Other");
    assert.deepEqual(groups[1]?.taskTitles, ["Orphan task"]);
  });

  it("states that applying copies onto the event without syncing later Library edits", () => {
    assert.match(APPLY_PREVIEW_ISOLATION_NOTE.toLowerCase(), /own checklist/);
    assert.match(APPLY_PREVIEW_ISOLATION_NOTE.toLowerCase(), /won't change/);
  });
});
