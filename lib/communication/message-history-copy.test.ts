/**
 * Recent-messages copy constants remain available; launch Communication Health
 * defers the aggregate history list that previously consumed them.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  BACK_TO_RECENT_MESSAGES,
  RECENT_MESSAGES_HEADING,
  RECENT_MESSAGES_HELPER,
} from "@/lib/communication/message-history-copy";

describe("recent messages copy constants", () => {
  it("uses the approved default heading and helper (not Sent population language)", () => {
    assert.equal(RECENT_MESSAGES_HEADING, "Recent messages");
    assert.equal(
      RECENT_MESSAGES_HELPER,
      "Newest inbound and outbound emails and texts. This list is not the full Sent or Delivered totals above — those count outbound delivery over the last 30 days.",
    );
    assert.doesNotMatch(RECENT_MESSAGES_HELPER, /Message History/i);
    assert.match(RECENT_MESSAGES_HELPER, /not the full Sent or Delivered/i);
    assert.match(RECENT_MESSAGES_HELPER, /last 30 days/i);
  });

  it("uses Back to recent messages for the empty-attention return path", () => {
    assert.equal(BACK_TO_RECENT_MESSAGES, "Back to recent messages");
  });
});

describe("health page launch presentation — recent messages list deferred", () => {
  const src = readFileSync("app/(app)/messaging/health/page.tsx", "utf8");

  it("does not wire recent-messages list headings on the health page", () => {
    assert.doesNotMatch(src, /RECENT_MESSAGES_HEADING/);
    assert.doesNotMatch(src, /RECENT_MESSAGES_HELPER/);
    assert.doesNotMatch(src, /MessageHistoryList/);
    assert.doesNotMatch(src, /"Message History"/);
  });

  it("keeps Communication Readiness as the primary health-page surface", () => {
    assert.match(src, /ReadinessChecklist/);
    assert.match(src, /data-testid="communication-readiness"/);
  });
});
