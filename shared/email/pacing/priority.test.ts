import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { priorityForCategory, type EmailSendCategory } from "./priority";

describe("email send priority classification", () => {
  it("marks access / contract / payment as critical", () => {
    const critical: EmailSendCategory[] = [
      "password_recovery",
      "account_invite",
      "client_portal_invite",
      "vendor_invite",
      "team_invite",
      "contract_signature",
      "payment_notice",
      "booking_notice",
      "tour_notice",
      "enrollment_lifecycle",
      "ops_internal",
    ];
    for (const c of critical) {
      assert.equal(priorityForCategory(c), "critical", c);
    }
  });

  it("marks sequences / digests / guest blasts as bulk", () => {
    const bulk: EmailSendCategory[] = [
      "scheduled_sequence",
      "guest_rsvp_invite",
      "digest",
      "saved_report",
      "task_reminder",
      "tour_reminder",
      "venue_notification",
      "feedback_ops",
      "uncategorized",
    ];
    for (const c of bulk) {
      assert.equal(priorityForCategory(c), "bulk", c);
    }
  });
});
