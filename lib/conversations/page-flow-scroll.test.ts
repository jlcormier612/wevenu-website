import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { nextWorkspaceMainScrollTop } from "@/lib/conversations/page-flow-scroll";

describe("page-flow scroll (Inbox)", () => {
  it("computes main scrollTop from target vs main viewport tops", () => {
    assert.equal(
      nextWorkspaceMainScrollTop({
        mainScrollTop: 120,
        mainViewportTop: 68,
        targetViewportTop: 200,
      }),
      252,
    );
    assert.equal(
      nextWorkspaceMainScrollTop({
        mainScrollTop: 40,
        mainViewportTop: 68,
        targetViewportTop: 20,
      }),
      0,
    );
  });

  it("ConversationThread page flow uses workspace-main scroll, not scrollIntoView", () => {
    const thread = readFileSync("components/conversations/conversation-thread.tsx", "utf8");
    assert.match(thread, /scrollWorkspaceMainToElement/);
    assert.match(thread, /Page flow \(Inbox\)/);
    assert.doesNotMatch(thread, /topRef\.current\?\.scrollIntoView/);
    assert.doesNotMatch(thread, /scrollIntoView\(\{\s*behavior,\s*block:\s*"start"\s*\}\)/);
  });

  it("inbox product still mounts ConversationThread in page flow", () => {
    const inbox = readFileSync("app/(app)/messaging/conversation-inbox.tsx", "utf8");
    assert.match(inbox, /flow="page"/);
  });
});
