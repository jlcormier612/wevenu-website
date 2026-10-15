import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  leadIdFromNotificationLink,
  selectMessageReceivedRecipients,
} from "@/lib/notifications/message-received-recipients";

describe("selectMessageReceivedRecipients (Decision A)", () => {
  it("includes owner when pref enabled and auth email present", () => {
    const recipients = selectMessageReceivedRecipients({
      prefMessageReceived: true,
      ownerAuthEmail: "owner@venue.test",
      assigneeStaffEmail: null,
    });
    assert.deepEqual(recipients.map((r) => r.email), ["owner@venue.test"]);
    assert.equal(recipients[0]?.role, "owner");
  });

  it("includes assigned lead staff when opted in", () => {
    const recipients = selectMessageReceivedRecipients({
      prefMessageReceived: true,
      ownerAuthEmail: null,
      assigneeStaffEmail: "assignee@venue.test",
      assigneeStaffId: "staff-1",
    });
    assert.deepEqual(recipients.map((r) => r.email), ["assignee@venue.test"]);
    assert.equal(recipients[0]?.role, "lead_assignee");
  });

  it("includes both owner and assignee when both eligible", () => {
    const recipients = selectMessageReceivedRecipients({
      prefMessageReceived: true,
      ownerAuthEmail: "owner@venue.test",
      assigneeStaffEmail: "assignee@venue.test",
    });
    assert.deepEqual(
      recipients.map((r) => r.email),
      ["owner@venue.test", "assignee@venue.test"],
    );
  });

  it("deduplicates when owner is also the assignee", () => {
    const recipients = selectMessageReceivedRecipients({
      prefMessageReceived: true,
      ownerAuthEmail: "same@venue.test",
      assigneeStaffEmail: "Same@venue.test",
      assigneeStaffId: "staff-owner",
    });
    assert.equal(recipients.length, 1);
    assert.equal(recipients[0]?.email, "same@venue.test");
    assert.equal(recipients[0]?.role, "owner");
  });

  it("excludes everyone when New message preference is disabled", () => {
    const recipients = selectMessageReceivedRecipients({
      prefMessageReceived: false,
      ownerAuthEmail: "owner@venue.test",
      assigneeStaffEmail: "assignee@venue.test",
    });
    assert.deepEqual(recipients, []);
  });

  it("does not invent recipients from venue contact or customer emails alone", () => {
    const recipients = selectMessageReceivedRecipients({
      prefMessageReceived: true,
      ownerAuthEmail: null,
      assigneeStaffEmail: null,
      customerEmails: ["customer@couple.test"],
      venueContactEmail: "venues-email@venue.test",
    });
    assert.deepEqual(recipients, []);
  });

  it("does not select customer address merely because it appears on the lead", () => {
    const recipients = selectMessageReceivedRecipients({
      prefMessageReceived: true,
      ownerAuthEmail: "owner@venue.test",
      assigneeStaffEmail: null,
      customerEmails: ["customer@couple.test", "owner@venue.test"],
      venueContactEmail: "customer@couple.test",
    });
    // Owner included via ownership identity — not via customer/venue contact fields.
    assert.deepEqual(recipients.map((r) => r.email), ["owner@venue.test"]);
    assert.equal(recipients[0]?.role, "owner");
  });

  it("unassigned staff are excluded (no assignee email → owner only)", () => {
    const recipients = selectMessageReceivedRecipients({
      prefMessageReceived: true,
      ownerAuthEmail: "owner@venue.test",
      assigneeStaffEmail: null,
    });
    assert.deepEqual(recipients.map((r) => r.email), ["owner@venue.test"]);
  });

  it("missing owner auth email does not invent a venues.email recipient", () => {
    const recipients = selectMessageReceivedRecipients({
      prefMessageReceived: true,
      ownerAuthEmail: null,
      assigneeStaffEmail: "assignee@venue.test",
      venueContactEmail: "venues-email@venue.test",
    });
    assert.deepEqual(recipients.map((r) => r.email), ["assignee@venue.test"]);
  });
});

describe("leadIdFromNotificationLink", () => {
  it("parses lead deep links", () => {
    assert.equal(
      leadIdFromNotificationLink("/leads/09d26751-f184-461f-9cdb-8891b676cd61#messages"),
      "09d26751-f184-461f-9cdb-8891b676cd61",
    );
  });

  it("returns null for non-lead links", () => {
    assert.equal(leadIdFromNotificationLink("/messaging?conversation=abc"), null);
  });
});

describe("message_received dispatcher wiring", () => {
  it("obligation engine routes message_received through recipient resolver", () => {
    const src = readFileSync(resolve("lib/notifications/obligation-engine.ts"), "utf8");
    assert.match(src, /resolveMessageReceivedRecipients/);
    assert.match(src, /dispatchPendingMessageReceivedEmails/);
    assert.match(src, /row\.type === "message_received"/);
    assert.doesNotMatch(
      src.slice(src.indexOf("async function dispatchMessageReceivedEmail"), src.indexOf("export async function processVenueNotificationEmails")),
      /venue\.email/,
    );
  });

  it("inbound email and SMS routes prompt-dispatch message_received", () => {
    const email = readFileSync(resolve("app/api/messaging/inbound/route.ts"), "utf8");
    const sms = readFileSync(resolve("app/api/messaging/sms-inbound/route.ts"), "utf8");
    assert.match(email, /dispatchPendingMessageReceivedEmails/);
    assert.match(sms, /dispatchPendingMessageReceivedEmails/);
  });

  it("idempotency skips already-logged recipients before resend", () => {
    const src = readFileSync(resolve("lib/notifications/obligation-engine.ts"), "utf8");
    assert.match(src, /alreadyLoggedRecipient/);
    assert.match(src, /\.eq\("status", "sent"\)/);
  });
});
