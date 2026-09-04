import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TASK_ACTION_TYPES,
  taskActionHref,
  taskActionLabel,
  taskActionOptionsForKind,
} from "@/lib/playbooks/constants";
import type { TaskActionType } from "@/lib/playbooks/types";

const ALL_TAB_HASHES = new Set([
  "overview", "playbook", "timeline", "floorplan", "documents", "vendors",
  "event-order", "inventory", "invoice", "messages", "activity", "notes",
  "team", "feedback",
]);

describe("Task Destination Audit — venue-side action types", () => {
  it("every action type resolves to a real event-detail tab", () => {
    for (const a of TASK_ACTION_TYPES) {
      assert.ok(
        ALL_TAB_HASHES.has(a.tabHash),
        `${a.value} points at tabHash "${a.tabHash}", which is not a real tab on the event page`,
      );
    }
  });

  it("taskActionHref builds an event-scoped hash link", () => {
    assert.equal(taskActionHref("questionnaire", "evt-1"), "/events/evt-1#overview");
    assert.equal(taskActionHref("timeline", "evt-1"), "/events/evt-1#timeline");
    assert.equal(taskActionHref("contract", "evt-1"), "/events/evt-1#documents");
    assert.equal(taskActionHref(null, "evt-1"), null);
  });

  it("taskActionLabel prefers a custom label over the default", () => {
    assert.equal(taskActionLabel("questionnaire", null), "Open Questionnaire");
    assert.equal(taskActionLabel("questionnaire", "Fill out your form"), "Fill out your form");
    assert.equal(taskActionLabel(null, "anything"), null);
  });

  it("wedding_website is offered to Client Planning tasks but hidden from Venue Planning — no venue-side page exists for it", () => {
    const clientOptions = taskActionOptionsForKind("client").map((a) => a.value);
    const venueOptions = taskActionOptionsForKind("venue").map((a) => a.value);
    assert.ok(clientOptions.includes("wedding_website"));
    assert.ok(!venueOptions.includes("wedding_website"));
  });

  it("every other action type is offered to both Client and Venue Planning", () => {
    const clientOptions = new Set(taskActionOptionsForKind("client").map((a) => a.value));
    const venueOptions = new Set(taskActionOptionsForKind("venue").map((a) => a.value));
    const universal: TaskActionType[] = [
      "vendor_library", "payments", "documents", "guest_list",
      "questionnaire", "contract", "timeline", "floor_plan",
      "event_order", "key_dates", "event_details",
    ];
    for (const value of universal) {
      assert.ok(clientOptions.has(value), `${value} missing from Client Planning options`);
      assert.ok(venueOptions.has(value), `${value} missing from Venue Planning options`);
    }
  });

  it("covers all 12 native workflows from the Task Destination Audit", () => {
    const values = TASK_ACTION_TYPES.map((a) => a.value).sort();
    assert.deepEqual(values, [
      "contract", "documents", "event_details", "event_order",
      "floor_plan", "guest_list", "key_dates", "payments",
      "questionnaire", "timeline", "vendor_library", "wedding_website",
    ]);
  });
});
