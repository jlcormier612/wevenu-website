import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import { messageDestinationHref } from "@/lib/communication/message-destination";

describe("messageDestinationHref", () => {
  it("prefers client over lead over conversation Inbox deep-link", () => {
    assert.equal(
      messageDestinationHref({
        clientId: "c1",
        leadId: "l1",
        conversationId: "conv1",
      }),
      "/clients/c1",
    );
    assert.equal(
      messageDestinationHref({
        clientId: null,
        leadId: "l1",
        conversationId: "conv1",
      }),
      "/leads/l1",
    );
    assert.equal(
      messageDestinationHref({
        clientId: null,
        leadId: null,
        conversationId: "conv-orphan",
      }),
      "/messaging?conversation=conv-orphan",
    );
  });

  it("returns null when no destination can be resolved", () => {
    assert.equal(
      messageDestinationHref({
        clientId: null,
        leadId: null,
        conversationId: null,
      }),
      null,
    );
  });

  it("Message History and health widget use the shared destination helper", () => {
    const list = readFileSync("components/messaging/message-history-list.tsx", "utf8");
    assert.match(list, /messageDestinationHref/);
    assert.match(list, /conversationId/);

    const dashboard = readFileSync("lib/communication/dashboard.ts", "utf8");
    assert.match(dashboard, /conversationId/);
    assert.match(dashboard, /inbox_owner_lead_id|inbox_owner_client_id/);

    const widget = readFileSync(
      "components/communication/communication-health-widget.tsx",
      "utf8",
    );
    assert.match(widget, /messageDestinationHref/);

    const health = readFileSync("lib/communication/health.ts", "utf8");
    assert.match(health, /conversationId/);
  });
});
