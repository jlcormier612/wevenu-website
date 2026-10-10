/**
 * Marking a tour complete uses the scheduled date and time unless the
 * venue says it happened at a different time.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  occurrenceEnteredSeparately,
  resolveLeadTourWrite,
} from "@/lib/leads/relationship-tour";

const card = readFileSync(resolve("components/leads/relationship-card.tsx"), "utf8");
const apply = readFileSync(resolve("lib/leads/repository.ts"), "utf8");

describe("tour completion defaults to the scheduled occurrence", () => {
  it("shows the helper and hides the actual fields until the exception is checked", () => {
    assert.match(card, /If the tour happened as scheduled, just mark it complete\. Only enter an actual date or time if it was different\./);
    assert.match(card, /The tour happened at a different date or time/);
    assert.match(card, /\{differentTime \? \(/);
    assert.match(card, /Actually occurred \(date\) \*/);
    assert.match(card, /Actually occurred \(time\) \*/);
    assert.match(card, /tourActualDate: input\.tourCompleted && differentTime \? input\.tourActualDate : ""/);
  });

  it("a failed save does not close the form as completed", () => {
    const save = card.slice(card.indexOf("function handleSave"), card.indexOf("const isEmpty"));
    assert.match(save, /const input = inputRef\.current/);
    assert.match(save, /const differentTime = differentTimeRef\.current/);
    const ok = save.slice(save.indexOf("if (result.ok)"), save.indexOf("} else {"));
    assert.match(ok, /setEditing\(false\)/);
    assert.doesNotMatch(save.slice(save.indexOf("} else {")), /setEditing\(false\)/);
    assert.match(save, /tourActualDate: input\.tourCompleted && differentTime \? input\.tourActualDate : ""/);
  });

  it("does not substitute the current clock, and leaves the scheduled slot unchanged", () => {
    const decision = resolveLeadTourWrite({
      tourDate: "2026-04-12",
      tourTime: "14:30",
      tourCompleted: true,
      tourNotes: "Private note",
      existing: {
        id: "appt-sched",
        status: "scheduled",
        scheduledAt: "2026-04-12T18:30:00.000Z",
        origin: "scheduled",
      },
    });
    assert.equal(decision.action, "complete_scheduled");
    if (decision.action !== "complete_scheduled") return;
    assert.equal(decision.actualDate, "2026-04-12");
    assert.equal(decision.actualTime, "14:30");
    assert.equal("scheduledAt" in decision, false);
    const completeBlock = apply.slice(
      apply.indexOf('decision.action === "complete_scheduled"'),
      apply.indexOf('decision.action === "actual_only"'),
    );
    assert.doesNotMatch(completeBlock, /scheduled_at:/);
    assert.match(completeBlock, /actual_occurred_at: actualOccurredAt/);
    assert.match(completeBlock, /actualOccurrenceIsFuture/);
  });

  it("saves a different actual time and rejects a partial one", () => {
    const saved = resolveLeadTourWrite({
      tourDate: "2026-04-12",
      tourTime: "14:30",
      tourActualDate: "2026-04-12",
      tourActualTime: "16:05",
      tourCompleted: true,
      tourNotes: "",
      existing: {
        id: "appt-diff",
        status: "scheduled",
        scheduledAt: "2026-04-12T18:30:00.000Z",
        origin: "scheduled",
      },
    });
    assert.equal(saved.action, "complete_scheduled");
    if (saved.action === "complete_scheduled") {
      assert.equal(saved.actualDate, "2026-04-12");
      assert.equal(saved.actualTime, "16:05");
    }
    const partial = resolveLeadTourWrite({
      tourDate: "2026-04-12",
      tourTime: "14:30",
      tourActualDate: "2026-04-12",
      tourActualTime: "",
      tourCompleted: true,
      tourNotes: "",
      existing: {
        id: "appt-diff",
        status: "scheduled",
        scheduledAt: "2026-04-12T18:30:00.000Z",
        origin: "scheduled",
      },
    });
    assert.equal(partial.action, "reject");
  });

  it("reload keeps a different occurrence on the exception and a matching one as scheduled", () => {
    assert.equal(occurrenceEnteredSeparately({
      completed: true,
      scheduledDate: "2026-04-12",
      scheduledTime: "14:30",
      actualDate: "2026-04-12",
      actualTime: "14:30",
    }), false);
    assert.equal(occurrenceEnteredSeparately({
      completed: true,
      scheduledDate: "2026-04-12",
      scheduledTime: "14:30",
      actualDate: "2026-04-12",
      actualTime: "16:05",
    }), true);
    assert.match(card, /differentTimeInitial\(lead\)/);
  });
});
