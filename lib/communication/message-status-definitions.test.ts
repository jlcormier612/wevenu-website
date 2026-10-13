import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  DASHBOARD_COUNT_NOTE,
  EMAIL_ENGAGEMENT_NOTE,
  MESSAGE_STATUS_DEFINITIONS,
} from "@/lib/communication/message-status-definitions";
import { MESSAGE_STATUS_META } from "@/lib/communication/status-labels";
import { aggregateOutboundStatusCounts } from "@/lib/communication/dashboard-counts";

describe("message status definitions vs real mapping", () => {
  it("covers Sent, Delivered, Opened, Clicked, Received, Replied, and failure attention", () => {
    const keys = MESSAGE_STATUS_DEFINITIONS.map((d) => d.key);
    assert.deepEqual(keys, [
      "sent",
      "delivered",
      "opened",
      "clicked",
      "received",
      "replied",
      "needs_attention",
    ]);
  });

  it("Sent maps to accepted (provider took it), not delivered", () => {
    assert.equal(MESSAGE_STATUS_META.accepted.label, "Sent");
    assert.equal(MESSAGE_STATUS_META.delivered.label, "Delivered");
    const webhook = readFileSync("app/api/messaging/webhook/route.ts", "utf8");
    assert.match(webhook, /"email\.sent":\s*"accepted"/);
    assert.match(webhook, /"email\.delivered":\s*"delivered"/);
    const sentDef = MESSAGE_STATUS_DEFINITIONS.find((d) => d.key === "sent")!;
    assert.match(sentDef.definition, /does not necessarily mean/i);
    const deliveredDef = MESSAGE_STATUS_DEFINITIONS.find((d) => d.key === "delivered")!;
    assert.match(deliveredDef.definition, /does not mean the recipient read/i);
    const openedDef = MESSAGE_STATUS_DEFINITIONS.find((d) => d.key === "opened")!;
    assert.match(openedDef.definition, /indicative tracking signal/i);
    assert.match(openedDef.definition, /not proof/i);
    const clickedDef = MESSAGE_STATUS_DEFINITIONS.find((d) => d.key === "clicked")!;
    assert.match(clickedDef.definition, /does not prove/i);
    assert.match(clickedDef.definition, /completed the action/i);
  });

  it("Received and Replied match inbound / reply-association behavior", () => {
    assert.equal(MESSAGE_STATUS_META.received.label, "Received");
    assert.equal(MESSAGE_STATUS_META.replied.label, "Replied");
    const inbound = readFileSync("app/api/messaging/inbound/route.ts", "utf8");
    assert.match(inbound, /status:\s*"replied"/);
    const smsInbound = readFileSync("app/api/messaging/sms-inbound/route.ts", "utf8");
    assert.match(smsInbound, /"replied"/);
    const receivedDef = MESSAGE_STATUS_DEFINITIONS.find((d) => d.key === "received")!;
    assert.match(receivedDef.definition, /incoming message/i);
    const repliedDef = MESSAGE_STATUS_DEFINITIONS.find((d) => d.key === "replied")!;
    assert.match(repliedDef.definition, /matched/i);
  });

  it("distinguishes email engagement from Delivered and notes SMS has no Read", () => {
    assert.match(EMAIL_ENGAGEMENT_NOTE, /Opened and Clicked/i);
    assert.match(EMAIL_ENGAGEMENT_NOTE, /email only/i);
    assert.match(EMAIL_ENGAGEMENT_NOTE, /not texts/i);
    assert.match(EMAIL_ENGAGEMENT_NOTE, /not proof/i);
    assert.equal(MESSAGE_STATUS_META.opened.label, "Opened");
    assert.equal(MESSAGE_STATUS_META.clicked.label, "Clicked");
  });

  it("aggregates dashboard counts: pending accepted is Sent only; failures need attention", () => {
    const counts = aggregateOutboundStatusCounts([
      "accepted",
      "accepted",
      "delivered",
      "opened",
      "replied",
      "failed",
      "undelivered",
      "sending",
    ]);
    // 8 outbound rows submitted
    assert.equal(counts.sent, 8);
    // delivered + opened + replied
    assert.equal(counts.delivered, 3);
    // failed + undelivered
    assert.equal(counts.needsAttention, 2);
    assert.match(DASHBOARD_COUNT_NOTE, /waiting on a delivery confirmation/i);
  });
});
