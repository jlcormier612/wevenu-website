import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { formatDate } from "@/lib/leads/constants";
import {
  followUpCompletedTitle,
  resolveFollowUpCompletion,
} from "@/lib/leads/follow-up-completion";

const current = {
  nextActionText: "Follow up after tour",
  followUpDate: "2026-10-02",
};

describe("resolveFollowUpCompletion", () => {
  it("refuses when there is no outstanding follow-up date", () => {
    const result = resolveFollowUpCompletion(
      { nextActionText: "Call", followUpDate: null },
      { kind: "no_further_follow_up" },
    );
    assert.equal(result.ok, false);
  });

  it("clears action and date for no further follow-up", () => {
    const result = resolveFollowUpCompletion(current, { kind: "no_further_follow_up" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.nextActionText, null);
    assert.equal(result.followUpDate, null);
    assert.equal(result.writeFollowUpSet, false);
    assert.equal(result.completedAction, "Follow up after tour");
    assert.equal(result.completedDate, "2026-10-02");
  });

  it("another follow-up requires action and date", () => {
    assert.equal(
      resolveFollowUpCompletion(current, { kind: "another_follow_up", nextActionText: "Follow up again" }).ok,
      false,
    );
    const result = resolveFollowUpCompletion(current, {
      kind: "another_follow_up",
      nextActionText: "Follow up again",
      followUpDate: "2026-10-09",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.nextActionText, "Follow up again");
    assert.equal(result.followUpDate, "2026-10-09");
    assert.equal(result.writeFollowUpSet, true);
    assert.equal(result.completedDate, "2026-10-02");
  });

  it("other next action without due date leaves no outstanding follow-up", () => {
    const result = resolveFollowUpCompletion(current, {
      kind: "other_next_action",
      nextActionText: "Send proposal",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.nextActionText, "Send proposal");
    assert.equal(result.followUpDate, null);
    assert.equal(result.writeFollowUpSet, false);
  });

  it("other next action with a due date establishes the new outstanding follow-up", () => {
    const result = resolveFollowUpCompletion(current, {
      kind: "other_next_action",
      nextActionText: "Send proposal",
      followUpDate: "2026-10-04",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.nextActionText, "Send proposal");
    assert.equal(result.followUpDate, "2026-10-04");
    assert.equal(result.writeFollowUpSet, true);
  });

  it("titles the completion activity with the completed date", () => {
    assert.equal(
      followUpCompletedTitle("2026-10-02", formatDate),
      "Follow-up completed — Oct 2, 2026",
    );
  });
});

describe("Follow-up completion wiring", () => {
  const card = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
  const service = readFileSync(resolve("lib/leads/service.ts"), "utf8");
  const actions = readFileSync(resolve("app/(app)/leads/[id]/actions.ts"), "utf8");
  const repo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
  const dashboard = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
  const bookClient = readFileSync(resolve("lib/booking-journey/book-client.ts"), "utf8");
  const constants = readFileSync(resolve("lib/leads/constants.ts"), "utf8");
  const timeline = readFileSync(resolve("components/leads/activity-timeline.tsx"), "utf8");

  it("shows Complete follow-up when an outstanding follow-up date exists", () => {
    assert.match(card, /lead\.followUpDate \?/);
    assert.match(card, /Complete follow-up/);
    assert.match(card, /What&apos;s next\?/);
    assert.match(card, /Another follow-up/);
    assert.match(card, /Other next action/);
    assert.match(card, /No further follow-up/);
    assert.match(card, /completeFollowUpAction/);
    assert.match(card, /startCompletion/);
  });

  it("completion writes follow_up_completed then optional follow_up_set", () => {
    const fn = service.slice(service.indexOf("export async function completeFollowUp"));
    assert.match(fn, /follow_up_completed/);
    assert.match(fn, /followUpCompletedTitle/);
    assert.match(fn, /resolved\.writeFollowUpSet && resolved\.followUpDate/);
    assert.match(fn, /follow_up_set/);
    assert.doesNotMatch(fn, /relationship_updated/);
    assert.doesNotMatch(fn, /lead_tasks/);
    assert.doesNotMatch(fn, /last_contacted/);
    assert.doesNotMatch(fn, /tourCompleted/);
  });

  it("patches only outstanding follow-up fields", () => {
    const fn = repo.slice(repo.indexOf("export async function updateOutstandingFollowUp"));
    assert.match(fn, /next_action_text: input\.nextActionText/);
    assert.match(fn, /follow_up_date: input\.followUpDate/);
    assert.doesNotMatch(fn, /last_contacted_at/);
    assert.doesNotMatch(fn, /next_action_due/);
    assert.doesNotMatch(fn, /upsertLeadTour/);
  });

  it("relationship editor last-contacted and tour complete stay off the completion path", () => {
    const save = card.slice(card.indexOf("function handleSave"), card.indexOf("const isEmpty"));
    assert.match(save, /updateRelationshipAction/);
    assert.doesNotMatch(save, /completeFollowUpAction/);
    assert.match(save, /contactedSet/);
    assert.match(card, /set\("tourCompleted"/);
    assert.match(card, /checked=\{input\.tourCompleted\}/);
  });

  it("tasks remain a separate completion path", () => {
    assert.match(service, /export async function setTaskCompleted/);
    const complete = service.slice(service.indexOf("export async function completeFollowUp"));
    assert.doesNotMatch(complete, /setTaskCompleted|lead_tasks|task_completed/);
    const taskFn = service.slice(service.indexOf("export async function setTaskCompleted"));
    assert.doesNotMatch(taskFn.slice(0, 800), /completeFollowUp|follow_up_completed|follow_up_date/);
  });

  it("dashboard overdue and due-today still use only follow_up_date on open leads", () => {
    assert.match(dashboard, /l\.followUpDate && l\.followUpDate < today/);
    assert.match(dashboard, /l\.followUpDate === today && isOpenLeadLifecycle/);
    assert.match(dashboard, /isOpenLeadLifecycle\(stage\)/);
  });

  it("booking does not opportunistically clear follow-up fields", () => {
    assert.doesNotMatch(bookClient, /follow_up_date/);
    assert.doesNotMatch(bookClient, /next_action_text/);
  });

  it("exposes the completion activity type for the timeline", () => {
    assert.match(constants, /follow_up_completed: "Follow-up completed"/);
    assert.match(timeline, /follow_up_completed:/);
    assert.match(actions, /completeFollowUpAction/);
    const types = readFileSync(resolve("lib/leads/types.ts"), "utf8");
    assert.match(types, /"follow_up_completed"/);
  });
});

describe("Luv remains a consumer of stored relationship fields", () => {
  it("completion does not call Luv or invent a Luv completion flag", () => {
    const service = readFileSync(resolve("lib/leads/service.ts"), "utf8");
    const fn = service.slice(service.indexOf("export async function completeFollowUp"));
    assert.doesNotMatch(fn, /buildFollowUpPrompt|follow-up-workflow-context|luv\/drafts/);
    assert.doesNotMatch(fn, /workflowIntent/);
  });

  it("cleared outstanding fields are what Luv would read from the lead", () => {
    const cleared = resolveFollowUpCompletion(current, { kind: "no_further_follow_up" });
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    assert.equal(cleared.nextActionText, null);
    assert.equal(cleared.followUpDate, null);
  });
});
