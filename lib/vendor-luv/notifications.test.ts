import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { vendorNotificationsToBriefingItems } from "@/lib/vendor-luv/notifications";
import type { VendorNotification } from "@/lib/vendor-notifications/types";

function notif(partial: Partial<VendorNotification> & Pick<VendorNotification, "type" | "id">): VendorNotification {
  return {
    title: partial.title ?? "Alert",
    body: partial.body ?? null,
    link: partial.link ?? "/vendor/events/a?tab=tasks&focus=t1",
    emoji: null,
    eventId: "e1",
    assignmentId: "a1",
    readAt: null,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("vendor Luv task acknowledgement vs completion", () => {
  it("never phrases task_acknowledged as final Couple completed a task", () => {
    const items = vendorNotificationsToBriefingItems([
      notif({
        id: "1",
        type: "task_acknowledged",
        title: "Couple says they've completed a task",
        body: "Waiting for your confirmation: Send preferred shot list",
      }),
    ]);
    assert.equal(items.length, 1);
    assert.match(items[0]!.detail, /Couple says they've completed a task:/);
    assert.doesNotMatch(items[0]!.detail, /^Couple completed a task/);
    assert.equal(items[0]!.label, "Needs your confirmation");
  });

  it("keeps task_completed copy only for true couple finalization", () => {
    const items = vendorNotificationsToBriefingItems([
      notif({
        id: "2",
        type: "task_completed",
        title: "Couple completed a task",
        body: "Leave a review",
        link: "/vendor/events/a?tab=tasks&focus=t2",
      }),
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.detail, "Couple completed a task: Leave a review");
  });
});
