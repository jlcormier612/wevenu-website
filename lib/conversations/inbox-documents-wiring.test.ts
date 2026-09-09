/**
 * I2 / I8 — Lead Documents deep link + relationship-anchored ConversationThread wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { documentsWorkspaceHref } from "@/lib/conversations/attachment-document";

describe("I2 lead Documents deep link", () => {
  it("documentsWorkspaceHref(lead) returns /leads/{id}#documents", () => {
    assert.equal(
      documentsWorkspaceHref({ leadId: "lead-abc", clientId: null }),
      "/leads/lead-abc#documents",
    );
  });

  it("LeadDetail syncs hash to Documents tab (initial + hashchange)", () => {
    const src = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    assert.match(src, /hashchange/);
    assert.match(src, /window\.location\.hash\.replace\("#", ""\)/);
    // Prefer hash; accept legacy ?tab= (e.g. conversation → messages) when no hash.
    assert.match(src, /const tab = hash \|\| \(tabParam === "conversation" \? "messages" : tabParam\) \|\| ""/);
    assert.match(src, /if \(tab\) setActiveTab\(tab\)/);
    assert.match(src, /window\.location\.hash = v/);
    // Ordinary tabs still controlled — no hash required to change tabs.
    assert.match(src, /onValueChange=\{\(v\) => \{ setActiveTab\(v\);/);
  });
});

describe("I8 relationship-anchored ConversationThread wiring", () => {
  it("Lead conversation tab passes lead/client identity", () => {
    const lead = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    const tab = readFileSync(
      resolve("components/conversations/relationship-conversation-tab.tsx"),
      "utf8",
    );
    assert.match(lead, /leadId=\{lead\.id\}/);
    assert.match(lead, /clientId=\{lead\.linkedClientId\}/);
    assert.match(tab, /leadId/);
    assert.match(tab, /clientId/);
    assert.match(tab, /summary=\{summary\}/);
    assert.match(tab, /ConversationThread/);
  });

  it("Event / Booking conversation tab passes lead + client identity", () => {
    const event = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
    assert.match(event, /leadId=\{originatingLeadId\}/);
    assert.match(event, /clientId=\{event\.clientId\}/);
    // Unambiguous event for Documents comes from relationship context (eventCount === 1),
    // not an invented earliest-event id from the open booking page.
    assert.doesNotMatch(
      event,
      /RelationshipConversationTab[\s\S]{0,200}eventId=\{event\.id\}/,
    );
  });

  it("vendor ConversationThread does not invent lead/client Documents context", () => {
    const vendors = readFileSync(
      resolve("components/events/vendors/event-vendors-section.tsx"),
      "utf8",
    );
    assert.match(
      vendors,
      /ConversationThread conversationId=\{a\.conversationId\} showHeader=\{false\}/,
    );
    assert.doesNotMatch(
      vendors,
      /ConversationThread[\s\S]{0,120}summary=/,
    );
  });

  it("ConversationThread Documents link uses event-aware href when identity exists", () => {
    const thread = readFileSync(
      resolve("components/conversations/conversation-thread.tsx"),
      "utf8",
    );
    assert.match(thread, /documentsWorkspaceHref\(\{ leadId, clientId, eventId \}\)/);
    assert.match(thread, /docsEventId/);
    assert.match(thread, /eventUnambiguous/);
  });
});
