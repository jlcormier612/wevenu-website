import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SHARE_TIMELINE_ACTION_TYPE,
  SHARE_TIMELINE_CELEBRATION_TYPE,
  actionTypeFromTitleNever,
  isShareTimelineVendorAttention,
  mayManuallyCompleteVendorTask,
  normalizeVendorTaskActionType,
  shareTimelineWorkspace,
  shouldPresentShareTimelineCelebration,
  vendorTasksCompletedByShare,
} from "./couple-share-timeline";

describe("couple share timeline verified completion (WP matrix)", () => {
  it("1. action_type share_timeline is the only normalized typed action", () => {
    assert.equal(normalizeVendorTaskActionType("share_timeline"), SHARE_TIMELINE_ACTION_TYPE);
    assert.equal(normalizeVendorTaskActionType(null), null);
    assert.equal(normalizeVendorTaskActionType("Share timeline"), null);
    assert.equal(normalizeVendorTaskActionType("timeline_submitted"), null);
  });

  it("2. never infer action_type from title", () => {
    assert.equal(actionTypeFromTitleNever("Share timeline"), null);
    assert.equal(actionTypeFromTitleNever("share your timeline with photographer"), null);
  });

  it("3. CTA / deep-link is #timeline/share via typed action", () => {
    const ws = shareTimelineWorkspace();
    assert.equal(ws.section, "timeline");
    assert.equal(ws.focus, "share");
    assert.equal(ws.actionLabel, "Share timeline");
  });

  it("4. Mark complete discouraged for share_timeline", () => {
    assert.equal(mayManuallyCompleteVendorTask("share_timeline"), false);
    assert.equal(mayManuallyCompleteVendorTask(null), true);
    assert.equal(mayManuallyCompleteVendorTask("other"), true);
  });

  it("5. share_timeline attention remains without canComplete", () => {
    assert.equal(
      isShareTimelineVendorAttention({
        status: "pending",
        coupleVisibility: "owned",
        actionType: "share_timeline",
        canComplete: false,
      }),
      true,
    );
  });

  it("6. open / navigate alone is not completion attention loss for unrelated rows", () => {
    assert.equal(
      isShareTimelineVendorAttention({
        status: "pending",
        coupleVisibility: "owned",
        actionType: null,
        canComplete: false,
      }),
      false,
    );
  });

  it("7. celebration presents only when celebrated === true", () => {
    assert.equal(shouldPresentShareTimelineCelebration(true), true);
    assert.equal(shouldPresentShareTimelineCelebration(false), false);
    assert.equal(shouldPresentShareTimelineCelebration(undefined), false);
    assert.equal(shouldPresentShareTimelineCelebration(null), false);
  });

  it("8. celebration type constant is timeline_shared_with_vendor", () => {
    assert.equal(SHARE_TIMELINE_CELEBRATION_TYPE, "timeline_shared_with_vendor");
  });

  it("9. successful share completes only matching vendor pending owned tasks", () => {
    const ids = vendorTasksCompletedByShare({
      eventId: "E",
      vendorId: "V_A",
      tasks: [
        {
          id: "t1",
          eventId: "E",
          vendorId: "V_A",
          coupleVisibility: "owned",
          actionType: "share_timeline",
          status: "pending",
        },
        {
          id: "t2",
          eventId: "E",
          vendorId: "V_B",
          coupleVisibility: "owned",
          actionType: "share_timeline",
          status: "pending",
        },
        {
          id: "t3",
          eventId: "E",
          vendorId: "V_A",
          coupleVisibility: "owned",
          actionType: null,
          status: "pending",
        },
        {
          id: "t4",
          eventId: "E",
          vendorId: "V_A",
          coupleVisibility: "visible",
          actionType: "share_timeline",
          status: "pending",
        },
        {
          id: "t5",
          eventId: "E",
          vendorId: "V_A",
          coupleVisibility: "owned",
          actionType: "share_timeline",
          status: "complete",
        },
      ],
    });
    assert.deepEqual(ids, ["t1"]);
  });

  it("10. Vendor A share does not complete Vendor B (scoping)", () => {
    const ids = vendorTasksCompletedByShare({
      eventId: "E",
      vendorId: "V_A",
      tasks: [
        {
          id: "a",
          eventId: "E",
          vendorId: "V_A",
          coupleVisibility: "owned",
          actionType: "share_timeline",
          status: "pending",
        },
        {
          id: "b",
          eventId: "E",
          vendorId: "V_B",
          coupleVisibility: "owned",
          actionType: "share_timeline",
          status: "pending",
        },
      ],
    });
    assert.deepEqual(ids, ["a"]);
    assert.ok(!ids.includes("b"));
  });

  it("11. titled Share timeline without action_type does not auto-complete", () => {
    const ids = vendorTasksCompletedByShare({
      eventId: "E",
      vendorId: "V",
      tasks: [
        {
          id: "ack",
          eventId: "E",
          vendorId: "V",
          coupleVisibility: "owned",
          actionType: null,
          status: "pending",
        },
      ],
    });
    assert.deepEqual(ids, []);
  });

  it("12. already-complete share_timeline is not re-completed (idempotent list)", () => {
    const ids = vendorTasksCompletedByShare({
      eventId: "E",
      vendorId: "V",
      tasks: [
        {
          id: "done",
          eventId: "E",
          vendorId: "V",
          coupleVisibility: "owned",
          actionType: "share_timeline",
          status: "complete",
        },
      ],
    });
    assert.deepEqual(ids, []);
  });

  it("13. wrong event_id never matches", () => {
    const ids = vendorTasksCompletedByShare({
      eventId: "E1",
      vendorId: "V",
      tasks: [
        {
          id: "x",
          eventId: "E2",
          vendorId: "V",
          coupleVisibility: "owned",
          actionType: "share_timeline",
          status: "pending",
        },
      ],
    });
    assert.deepEqual(ids, []);
  });

  it("14. private couple_visibility never matches", () => {
    const ids = vendorTasksCompletedByShare({
      eventId: "E",
      vendorId: "V",
      tasks: [
        {
          id: "p",
          eventId: "E",
          vendorId: "V",
          coupleVisibility: "private",
          actionType: "share_timeline",
          status: "pending",
        },
      ],
    });
    assert.deepEqual(ids, []);
  });

  it("15. visible (not owned) never auto-completes", () => {
    const ids = vendorTasksCompletedByShare({
      eventId: "E",
      vendorId: "V",
      tasks: [
        {
          id: "v",
          eventId: "E",
          vendorId: "V",
          coupleVisibility: "visible",
          actionType: "share_timeline",
          status: "pending",
        },
      ],
    });
    assert.deepEqual(ids, []);
  });

  it("16. cancel / fail / open → incomplete attention still true for pending typed task", () => {
    assert.equal(
      isShareTimelineVendorAttention({
        status: "pending",
        coupleVisibility: "owned",
        actionType: "share_timeline",
      }),
      true,
    );
  });

  it("17. success → drop from incomplete attention when status complete", () => {
    assert.equal(
      isShareTimelineVendorAttention({
        status: "complete",
        coupleVisibility: "owned",
        actionType: "share_timeline",
      }),
      false,
    );
  });
});
