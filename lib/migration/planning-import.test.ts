import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { pastEventAssignmentBlocked } from "@/lib/migration/event-vendor-assignment";
import {
  planningTaskCompletion,
  planningTimelineRole,
} from "@/lib/migration/planning-import";

describe("planning import rules", () => {
  it("keeps a completed task completed and does not invent a completion date", () => {
    assert.deepEqual(planningTaskCompletion({ taskStatus: "completed", completedAt: "2024-03-02" }), {
      status: "complete",
      completedAt: "2024-03-02",
    });
    assert.deepEqual(planningTaskCompletion({ taskStatus: "complete", completedAt: null }), {
      status: "complete",
      completedAt: null,
    });
    assert.deepEqual(planningTaskCompletion({ taskStatus: "pending", completedAt: "2024-03-02" }), {
      status: "pending",
      completedAt: null,
    });
  });

  it("keeps schedule rows off the manual timeline", () => {
    assert.equal(planningTimelineRole("schedule"), "schedule");
    assert.equal(planningTimelineRole("client"), "client");
    assert.equal(planningTimelineRole(""), "manual");
    assert.equal(planningTimelineRole("generated"), null);
  });

  it("does not treat a past event as active business unless historical coordination is requested", () => {
    assert.equal(pastEventAssignmentBlocked("2020-01-01", false, "2026-11-17"), true);
    assert.equal(pastEventAssignmentBlocked("2020-01-01", true, "2026-11-17"), false);
    assert.equal(pastEventAssignmentBlocked("2028-09-01", false, "2026-11-17"), false);
  });

  it("does not apply a setup profile, playbook, portal release, or external side effect", () => {
    const src = readFileSync(new URL("./planning-import.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /applySetupProfile|generatePlaybook|enqueueQuickBooksSync|stripe|resend|twilio/i);
    assert.match(src, /is_couple_visible: false/);
    assert.match(src, /shared_with_vendors: false/);
    assert.match(src, /source_space_use_key: null/);
    assert.match(src, /allowPastEvent: true/);
    assert.match(src, /selected=yes/);
    assert.doesNotMatch(src, /insertEntry\(/);
    assert.doesNotMatch(src, /ensureEventBookedAt|bookClient|book_relationship/);
  });
});
