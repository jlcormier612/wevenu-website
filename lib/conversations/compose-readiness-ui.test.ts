/**
 * D01 / D06 — readiness banners only when that channel is selected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  shouldShowEmailReadinessBanner,
  shouldShowSmsReadinessBanner,
} from "@/lib/conversations/compose-readiness-ui";

describe("compose readiness UI (D01 Progressive Disclosure)", () => {
  it("Portal + SMS not ready → SMS readiness copy absent", () => {
    assert.equal(
      shouldShowSmsReadinessBanner({ mode: "outbound", channel: "portal", smsReady: false }),
      false,
    );
  });

  it("Portal + Email not ready → Email readiness copy absent", () => {
    assert.equal(
      shouldShowEmailReadinessBanner({ mode: "outbound", channel: "portal", emailReady: false }),
      false,
    );
  });

  it("Email + Email not ready → Email readiness copy present", () => {
    assert.equal(
      shouldShowEmailReadinessBanner({ mode: "outbound", channel: "email", emailReady: false }),
      true,
    );
    assert.equal(
      shouldShowSmsReadinessBanner({ mode: "outbound", channel: "email", smsReady: false }),
      false,
    );
  });

  it("SMS + SMS not ready → SMS readiness copy present", () => {
    assert.equal(
      shouldShowSmsReadinessBanner({ mode: "outbound", channel: "sms", smsReady: false }),
      true,
    );
    assert.equal(
      shouldShowEmailReadinessBanner({ mode: "outbound", channel: "sms", emailReady: false }),
      false,
    );
  });

  it("Internal note + external channels not ready → external readiness absent", () => {
    assert.equal(
      shouldShowEmailReadinessBanner({ mode: "internal_note", channel: "internal_note", emailReady: false }),
      false,
    );
    assert.equal(
      shouldShowSmsReadinessBanner({ mode: "internal_note", channel: "internal_note", smsReady: false }),
      false,
    );
  });

  it("composer wires channel-conditional helpers (no ungated !emailReady||!smsReady banner)", () => {
    const compose = readFileSync(
      resolve("components/conversations/conversation-compose.tsx"),
      "utf8",
    );
    assert.match(compose, /shouldShowEmailReadinessBanner/);
    assert.match(compose, /shouldShowSmsReadinessBanner/);
    assert.doesNotMatch(
      compose,
      /!isNote && !channelDisabledReason && \(!emailReady \|\| !smsReady\)/,
    );
  });
});
