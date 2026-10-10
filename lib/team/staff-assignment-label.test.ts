/**
 * Explicit-save assignment button uses Edit/Save Assignment (or Edit/Save).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { assignmentActionLabel } from "@/lib/team/assignment-action-label";

const field = readFileSync(resolve("components/team/staff-assignment-field.tsx"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const eventDetail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const conversation = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");
const pipeline = readFileSync(resolve("components/leads/pipeline-booked-confirm-dialog.tsx"), "utf8");

describe("staff assignment action label", () => {
  it("uses Edit/Save Assignment with compact Edit/Save fallback", () => {
    assert.equal(assignmentActionLabel("staff-1"), "Edit/Save Assignment");
    assert.equal(assignmentActionLabel(""), "Edit/Save Assignment");
    assert.equal(assignmentActionLabel(null, { compact: true }), "Edit/Save");
  });

  it("tracks persistedId separately from dirty selected value", () => {
    assert.match(field, /const \[persistedId, setPersistedId\]/);
    assert.match(field, /assignmentActionLabel\(persistedId/);
    assert.match(field, /dirtyRef\.current = true/);
    assert.match(field, /if \(result\.ok\) \{[\s\S]*setPersistedId\(next\)/);
    const onChange = field.slice(
      field.indexOf("onValueChange={(next)"),
      field.indexOf("<SelectTrigger"),
    );
    assert.doesNotMatch(onChange, /setPersistedId/);
  });

  it("lead Sales owner and event Event owner both use StaffAssignmentField", () => {
    assert.match(leadDetail, /label="Sales owner"/);
    assert.match(leadDetail, /testId="lead-staff-assignment"/);
    assert.match(eventDetail, /label="Event owner"/);
    assert.match(eventDetail, /testId="event-owner-assignment"/);
  });

  it("documents exceptions that are not Edit/Save assignment controls", () => {
    assert.doesNotMatch(conversation, /Edit\/Save Assignment|Edit\/Save"/);
    assert.match(conversation, /Assigned coordinator/);
    assert.doesNotMatch(pipeline, /StaffAssignmentField/);
    assert.doesNotMatch(pipeline, /Edit\/Save Assignment/);
  });
});
