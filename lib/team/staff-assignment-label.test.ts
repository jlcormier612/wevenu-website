/**
 * Persisted assignment drives Edit vs Save label — not the unsaved dropdown.
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
  it("maps persisted id to Edit assignment and empty to Save assignment", () => {
    assert.equal(assignmentActionLabel("staff-1"), "Edit assignment");
    assert.equal(assignmentActionLabel("  staff-1  "), "Edit assignment");
    assert.equal(assignmentActionLabel(""), "Save assignment");
    assert.equal(assignmentActionLabel("   "), "Save assignment");
    assert.equal(assignmentActionLabel(null), "Save assignment");
    assert.equal(assignmentActionLabel(undefined), "Save assignment");
  });

  it("tracks persistedId separately from dirty selected value", () => {
    assert.match(field, /const \[persistedId, setPersistedId\]/);
    assert.match(field, /assignmentActionLabel\(persistedId\)/);
    assert.match(field, /dirtyRef\.current = true/);
    assert.match(field, /selectedRef\.current = resolved/);
    // Successful save updates persisted id; failed save must not.
    assert.match(field, /if \(result\.ok\) \{[\s\S]*setPersistedId\(next\)/);
    assert.doesNotMatch(
      field.slice(field.indexOf("} else {"), field.indexOf("toast.error")),
      /setPersistedId/,
    );
    // Unsaved select change must not set persistedId.
    const onChange = field.slice(
      field.indexOf("onValueChange={(next)"),
      field.indexOf("<SelectTrigger"),
    );
    assert.doesNotMatch(onChange, /setPersistedId/);
  });

  it("prop sync updates persisted id only when not dirty", () => {
    assert.match(field, /if \(dirtyRef\.current\) return/);
    assert.match(field, /setPersistedId\(value \?\? ""\)/);
  });

  it("lead Sales owner and event Event owner both use StaffAssignmentField", () => {
    assert.match(leadDetail, /label="Sales owner"/);
    assert.match(leadDetail, /testId="lead-staff-assignment"/);
    assert.match(leadDetail, /setLeadAssignedStaffAction/);
    assert.match(eventDetail, /label="Event owner"/);
    assert.match(eventDetail, /testId="event-owner-assignment"/);
    assert.match(eventDetail, /setEventAssignedStaffAction/);
    assert.doesNotMatch(
      eventDetail.slice(
        eventDetail.indexOf('data-testid="client-booking-staff-region"'),
        eventDetail.indexOf("{/* ── Tabs"),
      ),
      /Sales owner/,
    );
  });

  it("documents exceptions that are not Edit/Save assignment controls", () => {
    // Conversation coordinator auto-saves on select — no Save/Edit button.
    assert.doesNotMatch(conversation, /Save assignment|Edit assignment/);
    assert.match(conversation, /Assigned coordinator/);
    // Pipeline booked confirm embeds owner in a one-shot confirm, not StaffAssignmentField.
    assert.doesNotMatch(pipeline, /StaffAssignmentField/);
    assert.doesNotMatch(pipeline, /Save assignment|Edit assignment/);
  });
});
