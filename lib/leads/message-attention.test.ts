import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  leadMessageAttentionHref,
  leadShowsMessageAttention,
  pickLeadMessageAttention,
} from "@/lib/leads/message-attention";

describe("lead message attention (Decision C)", () => {
  it("shows when needs_response conversation is present even if venue_seen_at would be set", () => {
    const map = pickLeadMessageAttention([
      {
        leadId: "lead-1",
        conversationId: "conv-1",
        needsResponse: true,
        lastMessageAt: "2026-10-15T02:01:29Z",
      },
    ]);
    const attention = map.get("lead-1");
    assert.ok(attention);
    assert.equal(leadShowsMessageAttention(attention), true);
    assert.equal(attention.href, leadMessageAttentionHref("lead-1", "conv-1"));
  });

  it("hides when needs_response is false (attention resolved)", () => {
    const map = pickLeadMessageAttention([
      {
        leadId: "lead-1",
        conversationId: "conv-1",
        needsResponse: false,
        lastMessageAt: "2026-10-15T02:01:29Z",
      },
    ]);
    assert.equal(map.size, 0);
    assert.equal(leadShowsMessageAttention(null), false);
  });

  it("links to the conversation on the lead record", () => {
    assert.equal(
      leadMessageAttentionHref("09d26751-f184-461f-9cdb-8891b676cd61", "dcba7cbc-77d7-4707-ac0d-e615016c186f"),
      "/leads/09d26751-f184-461f-9cdb-8891b676cd61?conversation=dcba7cbc-77d7-4707-ac0d-e615016c186f#messages",
    );
  });

  it("does not bleed attention across unrelated leads", () => {
    const map = pickLeadMessageAttention([
      {
        leadId: "lead-a",
        conversationId: "conv-a",
        needsResponse: true,
        lastMessageAt: "2026-10-15T02:00:00Z",
      },
      {
        leadId: "lead-b",
        conversationId: "conv-b",
        needsResponse: false,
        lastMessageAt: "2026-10-15T03:00:00Z",
      },
    ]);
    assert.equal(map.has("lead-a"), true);
    assert.equal(map.has("lead-b"), false);
  });

  it("prefers the newest needing-response conversation for a lead", () => {
    const map = pickLeadMessageAttention([
      {
        leadId: "lead-1",
        conversationId: "older",
        needsResponse: true,
        lastMessageAt: "2026-10-14T00:00:00Z",
      },
      {
        leadId: "lead-1",
        conversationId: "newer",
        needsResponse: true,
        lastMessageAt: "2026-10-15T02:01:29Z",
      },
    ]);
    assert.equal(map.get("lead-1")?.conversationId, "newer");
  });

  it("UI and list/detail wiring use the indicator without overloading venue_seen_at", () => {
    const indicator = readFileSync(
      resolve("components/leads/lead-message-attention-indicator.tsx"),
      "utf8",
    );
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    const unseen = readFileSync(resolve("components/leads/lead-unseen-indicator.tsx"), "utf8");
    const inboxNeeds = readFileSync(resolve("lib/conversations/inbox-needs-response.test.ts"), "utf8");

    assert.match(indicator, /lead-message-attention-indicator/);
    assert.match(list, /LeadMessageAttentionIndicator/);
    assert.match(detail, /LeadMessageAttentionIndicator/);
    assert.doesNotMatch(indicator, /venueSeenAt=/);
    assert.doesNotMatch(indicator, /venueSeenAt:/);
    assert.match(unseen, /venueSeenAt/);
    // Locked Inbox contract still documented: open clears unread, not needs_response.
    assert.match(inboxNeeds, /must not clear needs_response/);
  });
});
