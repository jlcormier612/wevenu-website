/**
 * Phase 6 / incident repair: notification bells must use the backoff poller.
 *
 * Bare setInterval(fetch, 60_000) is what kept offering load to a failing
 * dependency during the 2026-09-28 incident. These assertions fail if a bell
 * is wired back to an unbounded interval.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const BELLS = [
  "components/shell/notification-bell.tsx",
  "components/portal/couple-notification-bell.tsx",
  "components/vendor-app/vendor-notification-bell.tsx",
];

describe("notification bells use bounded backoff polling", () => {
  for (const file of BELLS) {
    it(`${file} uses useBackoffPoll and does not setInterval the fetch`, () => {
      const src = readFileSync(file, "utf8");
      assert.match(src, /useBackoffPoll/, `${file} must use the shared backoff hook`);
      assert.doesNotMatch(
        src,
        /setInterval\(\s*fetchNotifications/,
        `${file} must not poll with a bare setInterval`,
      );
    });
  }
});
