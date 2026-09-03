import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPLY_PREVIEW_ISOLATION_NOTE,
  applyPreviewKindCopy,
  formatTemplateReminder,
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
    assert.equal(client.label, "For your couple");
    assert.match(client.explanation, /draft/i);
    assert.match(client.explanation, /release/i);
    assert.match(client.emptyState, /couple checklist/i);
    assert.equal(venue.label, "For your team");
    assert.match(venue.explanation, /venue team/i);
    assert.match(venue.explanation, /immediately/i);
    assert.match(venue.emptyState, /team checklist/i);
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
    assert.equal(groups[0]?.tasks[0]?.daysOffset, -30);
    assert.equal(groups[0]?.tasks[1]?.title, "Book hotel block");
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
    assert.equal(groups[1]?.tasks[0]?.title, "Orphan task");
  });

  it("states that applying copies onto the event without syncing later Library edits", () => {
    assert.match(APPLY_PREVIEW_ISOLATION_NOTE.toLowerCase(), /copy for this event/);
    assert.match(APPLY_PREVIEW_ISOLATION_NOTE.toLowerCase(), /won't change this event's task list/);
  });

  it("formats reminder offsets from the template only — does not invent a default", () => {
    assert.equal(formatTemplateReminder(null), null);
    assert.equal(formatTemplateReminder([]), null);
    assert.equal(formatTemplateReminder([7, 3, 1]), "Reminders: 7, 3, 1 days before due");
  });
});
