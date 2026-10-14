/**
 * Step A — default recent-messages labeling (no query/count changes).
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

describe("health page wires recent-messages copy in default mode only", () => {
  const src = readFileSync("app/(app)/messaging/health/page.tsx", "utf8");

  it("default heading and helper come from copy constants; Message History default heading is gone", () => {
    assert.match(src, /RECENT_MESSAGES_HEADING/);
    assert.match(src, /RECENT_MESSAGES_HELPER/);
    assert.match(src, /BACK_TO_RECENT_MESSAGES/);
    assert.doesNotMatch(src, /"Message History"/);
    assert.doesNotMatch(src, /Back to Message History/);
  });

  it("preserves Attention filter heading and helper (unchanged)", () => {
    assert.match(src, /Messages that need your attention/);
    assert.match(src, /Showing delivery failures from the last/);
    assert.match(src, /Clear filter/);
    assert.match(src, /paginate=\{showAttentionFilter\}/);
  });

  it("does not make Sent or Delivered tiles into links", () => {
    // Only the attention card uses attentionHref / Link wrapping a StatTile value path.
    assert.match(src, /attentionHref \? \(/);
    assert.match(src, /label=\{`messages sent \(last \$\{counts\.windowDays\} days\)`\}/);
    assert.match(src, /label="delivered successfully"/);
  });
});
