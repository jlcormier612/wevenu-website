import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

describe("Stage 1E Business Dashboard notifications presentation", () => {
  it("keeps alerts in a compact menu instead of a horizontal text strip", () => {
    const src = readFileSync(
      path.join(__dirname, "top-bar.tsx"),
      "utf8",
    );
    assert.match(src, /data-testid="notifications-menu-button"/);
    assert.match(src, /data-testid="notifications-menu"/);
    assert.match(src, /truncate/);
    assert.match(src, /Open Today for full activity/);
    assert.doesNotMatch(
      src,
      /hidden min-w-0 text-right lg:block[\s\S]*unread\.map/,
    );
  });

  it("supports individual dismiss and dismiss-all for CRM Alerts", () => {
    const src = readFileSync(path.join(__dirname, "top-bar.tsx"), "utf8");
    assert.match(src, /data-testid="notification-dismiss"/);
    assert.match(src, /data-testid="notifications-dismiss-all"/);
    assert.match(src, /\/api\/notifications\/dismiss/);
    assert.match(src, /Dismiss all/);
  });
});

describe("Stage 1E founder-review notification dismissal wiring", () => {
  it("persists per-actor dismissals without a new activity-history table", () => {
    const dismissals = readFileSync(
      path.join(__dirname, "../../lib/notifications/dismissals.ts"),
      "utf8",
    );
    const route = readFileSync(
      path.join(__dirname, "../../app/api/notifications/dismiss/route.ts"),
      "utf8",
    );
    const shell = readFileSync(
      path.join(__dirname, "app-shell.tsx"),
      "utf8",
    );
    assert.match(dismissals, /notification-dismissals\.jsonl/);
    assert.match(dismissals, /actorId/);
    assert.doesNotMatch(dismissals, /create table|activity_feed/i);
    assert.match(route, /requireWorkspaceStaff/);
    assert.match(shell, /getDismissedNotificationIdsSync/);
  });

  it("navigating an alert dismisses for the actor (not silent global-only)", () => {
    const link = readFileSync(
      path.join(__dirname, "../notifications/notification-nav-link.tsx"),
      "utf8",
    );
    assert.match(link, /\/api\/notifications\/dismiss/);
  });
});
